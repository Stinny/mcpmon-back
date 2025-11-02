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
    // Prepare request options - always use POST for streamable HTTP
    const requestOptions = {
      method: "POST",
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
