/**
 * MCP Client Service
 * Handles connections and communication with remote MCP servers
 */

/**
 * Test MCP server connection
 * @param {Object} monitor - Monitor object with connection details
 * @returns {Promise<Object>} - { success: boolean, responseTime: number, error?: string }
 */
export async function testMCPConnection(monitor) {
  const startTime = Date.now();

  try {
    // Prepare request options
    const requestOptions = {
      method: monitor.httpMethod || "POST",
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

    // Add body for POST requests
    if (monitor.httpMethod === "POST" && monitor.requestBody) {
      requestOptions.body = JSON.stringify(monitor.requestBody);
    }

    // Make the request
    const response = await fetch(monitor.url, requestOptions);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Check response status
    // Note: 4xx and 5xx errors mean the server is responding (UP), just with an error
    // We only consider the server DOWN if we can't connect at all
    if (!response.ok) {
      // Server is responding but with an error status
      // This counts as "up" because the server is reachable
      return {
        success: true, // Server is UP (responding)
        responseTime,
        statusCode: response.status,
        warning: `HTTP ${response.status}: ${response.statusText}`,
        type: "http-error",
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
            return {
              success: false,
              responseTime,
              error: "SSE stream ended without data",
            };
          }

          buffer += decoder.decode(value, { stream: true });
          clearTimeout(readTimeout);

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              const data = line.substring(5).trim();
              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  // Check for valid JSON-RPC response
                  if (parsed.jsonrpc === "2.0") {
                    hasValidData = true;
                    break;
                  }
                } catch (e) {
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
          return {
            success: true,
            responseTime,
            type: "sse",
          };
        } else {
          return {
            success: false,
            responseTime,
            error: "SSE stream did not contain valid JSON-RPC data",
          };
        }
      } catch (sseError) {
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

        // Basic validation for JSON-RPC response
        if (data.jsonrpc !== "2.0") {
          return {
            success: false,
            responseTime,
            error: "Invalid JSON-RPC response format",
          };
        }

        return {
          success: true,
          responseTime,
          type: "http",
          data,
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
