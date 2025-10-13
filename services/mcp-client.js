/**
 * MCP Client Service
 * Handles connections and communication with remote MCP servers
 */

import { decryptAuthConfig } from "../utils/encryption.js";

/**
 * Apply authentication headers based on monitor's auth configuration
 * @param {Object} monitor - Monitor object with auth details
 * @param {Object} headers - Existing headers object
 * @returns {Object} - Headers with authentication applied
 */
function applyAuthHeaders(monitor, headers) {
  if (!monitor.authType || monitor.authType === "none" || !monitor.authConfig) {
    console.log(
      `[Auth] Monitor "${monitor.name || monitor._id}": No auth configured (authType: ${monitor.authType})`,
    );
    return headers;
  }

  console.log(
    `[Auth] Monitor "${monitor.name || monitor._id}": Applying auth type "${monitor.authType}"`,
  );

  try {
    const authConfig = decryptAuthConfig(monitor.authType, monitor.authConfig);
    if (!authConfig) {
      console.warn(
        `[Auth] Failed to decrypt auth config for monitor ${monitor._id}`,
      );
      return headers;
    }

    switch (monitor.authType) {
      case "api-key":
        // Add API key with custom header name
        headers[authConfig.headerName] = authConfig.apiKey;
        console.log(`[Auth] Added API key header: ${authConfig.headerName}`);
        break;

      case "bearer-token":
        // Add Bearer token
        headers["Authorization"] = `Bearer ${authConfig.token}`;
        console.log(`[Auth] Added Authorization header with Bearer token`);
        break;

      case "custom-headers":
        // Add all custom headers
        if (authConfig.headers) {
          Object.assign(headers, authConfig.headers);
          console.log(
            `[Auth] Added custom headers: ${Object.keys(authConfig.headers).join(", ")}`,
          );
        }
        break;

      default:
        console.warn(`[Auth] Unknown auth type: ${monitor.authType}`);
    }
  } catch (error) {
    console.error(
      `[Auth] Error applying auth headers for monitor ${monitor._id}:`,
      error.message,
    );
  }

  return headers;
}

/**
 * Test MCP server connection
 * @param {Object} monitor - Monitor object with connection details
 * @returns {Promise<Object>} - { success: boolean, responseTime: number, error?: string }
 */
export async function testMCPConnection(monitor) {
  const startTime = Date.now();

  try {
    // Determine request method based on server type
    const serverType = monitor.serverType || "http-jsonrpc";
    let method = "POST";

    if (serverType === "sse" || serverType === "sse-session") {
      // SSE servers typically use GET
      method = "GET";
    } else if (monitor.httpMethod) {
      // Allow manual override
      method = monitor.httpMethod;
    }

    console.log(`[MCP Client] Server type: ${serverType}, Method: ${method}`);

    // Prepare request options
    const requestOptions = {
      method,
      headers: {},
      signal: AbortSignal.timeout(monitor.timeout * 1000), // Convert seconds to milliseconds
    };

    // Add headers
    if (monitor.requestHeaders) {
      const headers =
        monitor.requestHeaders instanceof Map
          ? Object.fromEntries(monitor.requestHeaders)
          : monitor.requestHeaders;
      requestOptions.headers = { ...headers };
    }

    // Apply authentication headers
    requestOptions.headers = applyAuthHeaders(monitor, requestOptions.headers);

    // Add body for POST requests only
    if (method === "POST" && monitor.requestBody) {
      requestOptions.body = JSON.stringify(monitor.requestBody);
    }

    console.log(requestOptions);

    // Make the request
    const response = await fetch(monitor.url, requestOptions);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    console.log(`[Response] Status: ${response.status} ${response.statusText}`);
    console.log(`[Response] Content-Type: ${response.headers.get("content-type")}`);

    // Check response status
    // Note: 4xx and 5xx errors mean the server is responding (UP), just with an error
    // We only consider the server DOWN if we can't connect at all
    if (!response.ok) {
      // Try to read error body for logging
      let errorBody = null;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          errorBody = await response.json();
        } else {
          errorBody = await response.text();
        }
        console.log(`[Response] Error body:`, errorBody);
      } catch (e) {
        console.log(`[Response] Could not read error body:`, e.message);
      }

      // Check for authentication-related errors
      const isAuthError = response.status === 401 || response.status === 403;

      // Check for session-based errors that indicate server is working
      // Some MCP servers require session establishment and will return 400 errors
      // for requests without a valid session, but this means auth is working
      const serverType = monitor.serverType || "http-jsonrpc";
      const isSessionError =
        serverType === "sse-session" &&
        response.status === 400 &&
        errorBody &&
        (errorBody.includes("session") ||
         errorBody.includes("Invalid session ID") ||
         errorBody.includes("missing required") ||
         errorBody.includes("GET requests are disabled"));

      // Determine auth status based on the error and current auth configuration
      let authStatus = null;
      if (isAuthError) {
        // If we get 401/403 and have no auth configured, auth is required but missing
        // If we have auth configured but still get 401/403, credentials are invalid
        authStatus = monitor.authType === "none" ? "untested" : "invalid";
      } else if (isSessionError && monitor.authType !== "none") {
        // Session errors with auth configured means auth passed but session is needed
        authStatus = "valid";
      }

      // Server is responding but with an error status
      // This counts as "up" because the server is reachable
      return {
        success: true, // Server is UP (responding)
        responseTime,
        statusCode: response.status,
        warning: `HTTP ${response.status}: ${response.statusText}`,
        type: "http-error",
        authError: isAuthError,
        authStatus,
        isSessionError,
      };
    }

    // Validate response content type
    const contentType = response.headers.get("content-type");
    if (!contentType) {
      return {
        success: false,
        responseTime,
        error: "Missing content-type header",
      };
    }

    // Handle SSE (Server-Sent Events) responses
    if (contentType.includes("text/event-stream")) {
      console.log(`[Response] Handling SSE stream...`);
      try {
        // For SSE, we need to read the stream and parse events
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let hasValidData = false;

        // Read first chunk with timeout
        const readTimeout = setTimeout(() => {
          reader.cancel("Timeout reading SSE stream");
        }, 5000); // 5 second timeout for first chunk

        try {
          const { value, done } = await reader.read();

          if (done) {
            clearTimeout(readTimeout);
            console.log(`[Response] SSE stream ended without data`);
            return {
              success: false,
              responseTime,
              error: "SSE stream ended without data",
            };
          }

          buffer += decoder.decode(value, { stream: true });
          clearTimeout(readTimeout);

          console.log(`[Response] SSE raw buffer:`, buffer);

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          for (const line of lines) {
            console.log(`[Response] SSE line:`, line);
            if (line.startsWith("data:")) {
              const data = line.substring(5).trim();
              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  console.log(`[Response] SSE parsed data:`, parsed);
                  // Check for valid JSON-RPC response
                  if (parsed.jsonrpc === "2.0") {
                    hasValidData = true;
                    break;
                  }
                } catch (e) {
                  console.log(`[Response] Failed to parse SSE data as JSON:`, e.message);
                  // Continue parsing other lines
                }
              }
            }
          }
        } finally {
          // Clean up reader
          await reader.cancel();
        }

        if (hasValidData) {
          // Determine auth status based on configuration
          // If auth is configured and we got a successful response, it's valid
          // If no auth is configured and we got success, auth is not required
          const authStatus =
            monitor.authType === "none" ? "not-required" : "valid";

          console.log(`[Response] SSE validation successful`);
          return {
            success: true,
            responseTime,
            type: "sse",
            authStatus,
          };
        } else {
          console.log(`[Response] SSE did not contain valid JSON-RPC data`);
          return {
            success: false,
            responseTime,
            error: "SSE stream did not contain valid JSON-RPC data",
          };
        }
      } catch (sseError) {
        console.log(`[Response] SSE error:`, sseError.message);
        return {
          success: false,
          responseTime,
          error: `SSE parsing error: ${sseError.message}`,
        };
      }
    }

    // Handle standard HTTP/JSON responses
    if (contentType.includes("application/json")) {
      try {
        const data = await response.json();
        console.log(`[Response] JSON body:`, data);

        // Basic validation for JSON-RPC response
        if (data.jsonrpc !== "2.0") {
          return {
            success: false,
            responseTime,
            error: "Invalid JSON-RPC response format",
          };
        }

        // Determine auth status based on configuration
        // If auth is configured and we got a successful response, it's valid
        // If no auth is configured and we got success, auth is not required
        const authStatus =
          monitor.authType === "none" ? "not-required" : "valid";

        return {
          success: true,
          responseTime,
          type: "http",
          data,
          authStatus,
        };
      } catch (parseError) {
        return {
          success: false,
          responseTime,
          error: `Failed to parse JSON response: ${parseError.message}`,
        };
      }
    }

    // Unsupported content type
    return {
      success: false,
      responseTime,
      error: `Unsupported content type: ${contentType}`,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Handle different types of errors
    let errorMessage = error.message;

    if (error.name === "AbortError" || error.name === "TimeoutError") {
      errorMessage = `Request timeout after ${monitor.timeout} seconds`;
    } else if (error.code === "ENOTFOUND") {
      errorMessage = "DNS resolution failed - host not found";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "Connection refused";
    } else if (error.code === "ECONNRESET") {
      errorMessage = "Connection reset";
    } else if (error.code === "ETIMEDOUT") {
      errorMessage = "Connection timeout";
    }

    return {
      success: false,
      responseTime,
      error: errorMessage,
    };
  }
}

/**
 * Test MCP connection with retry logic
 * @param {Object} monitor - Monitor object with connection details
 * @returns {Promise<Object>} - { success: boolean, responseTime: number, error?: string, attempts: number }
 */
export async function testMCPConnectionWithRetry(monitor) {
  const maxAttempts = monitor.retryAttempts || 3;
  let lastResult = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await testMCPConnection(monitor);

    if (lastResult.success) {
      return {
        ...lastResult,
        attempts: attempt,
      };
    }

    // Wait before retrying (exponential backoff)
    if (attempt < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5 seconds
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    ...lastResult,
    attempts: maxAttempts,
  };
}
