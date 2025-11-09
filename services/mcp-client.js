/**
 * MCP Client Service
 * Handles connections and communication with remote MCP servers
 */

import * as sessionManager from "./sessionManager.js";

/**
 * Parse SSE (Server-Sent Events) response to extract JSON-RPC message
 * @param {string} sseText - Raw SSE response text
 * @returns {Object|null} - Parsed JSON-RPC message or null
 */
function parseSSEResponse(sseText) {
  try {
    // SSE format:
    // event: message
    // data: {"jsonrpc":"2.0",...}
    //
    // or just:
    // data: {"jsonrpc":"2.0",...}

    const lines = sseText.trim().split("\n");
    let dataLines = [];

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        dataLines.push(line.substring(6)); // Remove 'data: ' prefix
      } else if (line.startsWith("data:")) {
        dataLines.push(line.substring(5)); // Remove 'data:' prefix
      }
    }

    if (dataLines.length === 0) {
      return null;
    }

    // Join multi-line data and parse as JSON
    const jsonData = dataLines.join("\n");
    return JSON.parse(jsonData);
  } catch (error) {
    console.error(`[SSE Parser] Failed to parse SSE response:`, error.message);
    return null;
  }
}

/**
 * Read SSE stream and extract first valid JSON-RPC message
 * SSE streams can stay open indefinitely, so we read until we get the first message
 * @param {Response} response - Fetch response object with SSE stream
 * @returns {Promise<Object|null>} - Parsed JSON-RPC message or null
 */
async function readFirstSSEMessage(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = null;
  let currentData = [];

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.substring(6).trim();
        } else if (line.startsWith("data:")) {
          currentData.push(line.substring(5).trim());
        } else if (line === "") {
          // Empty line marks end of event
          if (currentEvent === "message" || (currentEvent === null && currentData.length > 0)) {
            // We got a message event, try to parse it
            const jsonStr = currentData.join("\n");
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.jsonrpc === "2.0") {
                // Found valid JSON-RPC message, abort the stream and return
                reader.cancel();
                return parsed;
              }
            } catch (e) {
              // Not valid JSON, continue reading
            }
          }
          // Reset for next event
          currentEvent = null;
          currentData = [];
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`[SSE Reader] Failed to read SSE stream:`, error.message);
    reader.cancel();
    return null;
  }
}

/**
 * Build authentication headers based on monitor auth configuration
 * @param {Object} monitor - Monitor object with auth details
 * @returns {Object} - Headers object with authentication
 */
function buildAuthHeaders(monitor) {
  const headers = {};

  // Add base request headers
  if (monitor.requestHeaders) {
    const baseHeaders =
      monitor.requestHeaders instanceof Map
        ? Object.fromEntries(monitor.requestHeaders)
        : monitor.requestHeaders;
    Object.assign(headers, baseHeaders);
  }

  // Add authentication headers
  const decryptedToken = monitor.getDecryptedAuthToken
    ? monitor.getDecryptedAuthToken()
    : null;

  if (decryptedToken && monitor.authType === "bearer") {
    headers["Authorization"] = `Bearer ${decryptedToken}`;
  } else if (decryptedToken && monitor.authType === "apikey") {
    const headerName = monitor.authHeaderName || "X-API-Key";
    headers[headerName] = decryptedToken;
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
    // Prepare request options - always use POST for streamable HTTP
    const headers = buildAuthHeaders(monitor);
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "text/event-stream, application/json";

    const requestOptions = {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(monitor.timeout * 1000), // Convert seconds to milliseconds
    };

    // Add request body
    if (monitor.requestBody) {
      requestOptions.body = JSON.stringify(monitor.requestBody);
    }

    // Make the request
    const response = await fetch(monitor.url, requestOptions);

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // Check response status
    // Note: Any response (even 4xx and 5xx errors) means the server is UP and responding
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

    // Handle HTTP/JSON responses
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
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

        return {
          success: true,
          responseTime,
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

    // Missing or unsupported content type
    return {
      success: false,
      responseTime,
      error: contentType
        ? `Unsupported content type: ${contentType}`
        : "Missing content-type header",
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

/**
 * Initialize MCP session with handshake
 * @param {Object} monitor - Monitor object with connection details
 * @returns {Promise<Object>} - { success: boolean, sessionId: string, capabilities: Object, error?: string }
 */
export async function initializeMCPSession(monitor) {
  try {
    const headers = buildAuthHeaders(monitor);
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "text/event-stream, application/json";

    // Step 1: Send initialize request
    const initializeRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: monitor.protocolVersion || "2024-11-05",
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: "mcpmon",
          version: "1.0.0",
        },
      },
    };

    const initResponse = await fetch(monitor.url, {
      method: "POST",
      headers,
      body: JSON.stringify(initializeRequest),
      signal: AbortSignal.timeout(monitor.timeout * 1000),
    });

    if (!initResponse.ok) {
      throw new Error(
        `HTTP ${initResponse.status}: ${initResponse.statusText}`,
      );
    }

    // Check if response is SSE or JSON
    const contentType = initResponse.headers.get("content-type");
    let initData;

    if (contentType && contentType.includes("text/event-stream")) {
      // Read first message from SSE stream (don't wait for stream to end)
      initData = await readFirstSSEMessage(initResponse);

      if (!initData) {
        throw new Error("Failed to read SSE message");
      }
    } else {
      // Parse JSON response
      initData = await initResponse.json();
    }

    if (initData.error) {
      throw new Error(initData.error.message || "Initialize failed");
    }

    // Extract session ID from response headers (optional for some servers)
    const sessionId =
      initResponse.headers.get("Mcp-Session-Id") ||
      initData.result?.sessionId ||
      null;

    console.log(
      `[MCP Client] Initialize response received${sessionId ? ` with session ID: ${sessionId}` : " (no session ID)"}`,
    );

    // Step 2: Send initialized notification
    const initializedHeaders = { ...headers };
    if (sessionId) {
      initializedHeaders["Mcp-Session-Id"] = sessionId;
    }

    const initializedNotification = {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    };

    await fetch(monitor.url, {
      method: "POST",
      headers: initializedHeaders,
      body: JSON.stringify(initializedNotification),
      signal: AbortSignal.timeout(monitor.timeout * 1000),
    });

    console.log(
      `[MCP Client] Session initialized for monitor ${monitor._id}: ${sessionId}`,
    );

    return {
      success: true,
      sessionId,
      capabilities: initData.result?.capabilities || null,
    };
  } catch (error) {
    console.error(`[MCP Client] Session initialization failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Discover tools from MCP server
 * @param {Object} monitor - Monitor object with connection details
 * @param {string} sessionId - MCP session ID
 * @returns {Promise<Object>} - { success: boolean, tools: Array, error?: string }
 */
export async function discoverTools(monitor, sessionId) {
  try {
    const headers = buildAuthHeaders(monitor);
    headers["Content-Type"] = "application/json";
    headers["Accept"] = "text/event-stream, application/json";

    if (sessionId) {
      headers["Mcp-Session-Id"] = sessionId;
    }

    const toolsListRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    };

    const response = await fetch(monitor.url, {
      method: "POST",
      headers,
      body: JSON.stringify(toolsListRequest),
      signal: AbortSignal.timeout(monitor.timeout * 1000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check if response is SSE or JSON
    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("text/event-stream")) {
      // Read first message from SSE stream (don't wait for stream to end)
      data = await readFirstSSEMessage(response);

      if (!data) {
        throw new Error("Failed to read SSE message");
      }
    } else {
      // Parse JSON response
      data = await response.json();
    }

    if (data.error) {
      throw new Error(data.error.message || "Tool discovery failed");
    }

    const tools = data.result?.tools || [];

    console.log(
      `[MCP Client] Discovered ${tools.length} tools for monitor ${monitor._id}`,
    );

    return {
      success: true,
      tools,
    };
  } catch (error) {
    console.error(`[MCP Client] Tool discovery failed:`, error.message);
    return {
      success: false,
      error: error.message,
      tools: [],
    };
  }
}

/**
 * Test MCP connection with session management and tool discovery
 * @param {Object} monitor - Monitor object with connection details
 * @returns {Promise<Object>} - { success: boolean, responseTime: number, tools: Array, error?: string }
 */
export async function testMCPConnectionWithTools(monitor) {
  const startTime = Date.now();
  let tools = [];
  let sessionId = monitor.sessionId;
  let sessionResult = null;

  try {
    // Try to get cached session
    const cachedSession = sessionManager.getSession(monitor._id);

    // Check if cached session exists and URL hasn't changed
    if (cachedSession && cachedSession.url === monitor.url) {
      sessionId = cachedSession.sessionId;
      console.log(
        `[MCP Client] Using cached session for monitor ${monitor._id}`,
      );

      // Session exists, server is considered healthy
      sessionResult = { success: true };
    } else {
      // Clear stale session if URL changed
      if (cachedSession && cachedSession.url !== monitor.url) {
        console.log(
          `[MCP Client] URL changed for monitor ${monitor._id}, clearing cached session`,
        );
        sessionManager.clearSession(monitor._id);
      }

      // Initialize new session - this serves as the health check
      console.log(
        `[MCP Client] Initializing new session for monitor ${monitor._id}`,
      );
      sessionResult = await initializeMCPSession(monitor);

      if (sessionResult.success) {
        sessionId = sessionResult.sessionId;

        // Cache the session with URL
        sessionManager.setSession(
          monitor._id,
          sessionId,
          sessionResult.capabilities,
          monitor.url,
        );

        // Update monitor with session info
        if (monitor.sessionId !== sessionId) {
          monitor.sessionId = sessionId;
          monitor.serverCapabilities = sessionResult.capabilities;
        }
      } else {
        // Session initialization failed - server is down or not responding correctly
        return {
          success: false,
          responseTime: Date.now() - startTime,
          error: sessionResult.error || "Failed to initialize MCP session",
          tools: [],
        };
      }
    }

    // Discover tools if enabled (session ID is optional)
    if (monitor.toolsSyncEnabled) {
      const toolsResult = await discoverTools(monitor, sessionId);

      if (toolsResult.success) {
        tools = toolsResult.tools;
      } else {
        console.warn(
          `[MCP Client] Tool discovery failed: ${toolsResult.error}`,
        );

        // If tool discovery fails due to session error, clear the session and retry
        if (
          toolsResult.error.includes("session") ||
          toolsResult.error.includes("401") ||
          toolsResult.error.includes("HTTP")
        ) {
          console.log(
            `[MCP Client] Session invalid, clearing and reinitializing...`,
          );
          sessionManager.clearSession(monitor._id);

          // Try to reinitialize
          const retryResult = await initializeMCPSession(monitor);
          if (retryResult.success) {
            sessionId = retryResult.sessionId;
            sessionManager.setSession(
              monitor._id,
              sessionId,
              retryResult.capabilities,
              monitor.url,
            );

            // Retry tool discovery
            const retryToolsResult = await discoverTools(monitor, sessionId);
            if (retryToolsResult.success) {
              tools = retryToolsResult.tools;
            } else {
              // Both tool discovery and retry failed - server is likely down
              console.error(
                `[MCP Client] Tool discovery retry also failed, marking as offline`,
              );
              return {
                success: false,
                responseTime: Date.now() - startTime,
                error: retryToolsResult.error || "Tool discovery failed after retry",
                tools: [],
              };
            }
          } else {
            // Reinitialize failed - server is down
            console.error(
              `[MCP Client] Session reinitialize failed, marking as offline`,
            );
            return {
              success: false,
              responseTime: Date.now() - startTime,
              error: retryResult.error || "Failed to reinitialize session",
              tools: [],
            };
          }
        }
      }
    }

    const responseTime = Date.now() - startTime;

    return {
      success: true,
      responseTime,
      tools,
      sessionId,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    console.error(
      `[MCP Client] Connection test with tools failed:`,
      error.message,
    );

    // Clear session on error
    if (sessionId) {
      sessionManager.clearSession(monitor._id);
    }

    return {
      success: false,
      responseTime,
      error: error.message,
      tools: [],
    };
  }
}
