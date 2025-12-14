import { testMCPConnectionWithTools } from "../services/mcp-client.js";
import { performPublicSecurityScan } from "../services/publicScanner.js";
import { encryptAuthToken, decryptAuthToken } from "../utils/encryption.js";

/**
 * Validate server URL format
 * @param {String} url - URL to validate
 * @returns {Boolean} True if valid
 */
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === "http:" || urlObj.protocol === "https:";
  } catch (error) {
    return false;
  }
}

/**
 * Perform a one-time scan of an MCP server
 * Public endpoint - no authentication required
 * @route POST /api/public/scan-server
 */
export async function scanServer(req, res) {
  try {
    const { url, requiresAuth, authHeader, authToken } = req.body;

    // Validate required fields
    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Server URL is required",
      });
    }

    // Validate URL format
    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message: "Invalid URL. Must be a valid HTTP or HTTPS URL",
      });
    }

    // Validate auth fields if authentication is required
    if (requiresAuth && !authToken) {
      return res.status(400).json({
        success: false,
        message: "Auth token is required when authentication is enabled",
      });
    }

    // Create temporary monitor-like object (not saved to database)
    const tempMonitor = {
      _id: "temp-" + Date.now(), // Temporary ID for session manager
      url,
      requiresAuth: requiresAuth || false,
      authHeader: authHeader || "Authorization",
      authToken: requiresAuth ? encryptAuthToken(authToken) : null,
      timeout: 30,
      retryAttempts: 1,
      toolsSyncEnabled: true,
      protocolVersion: "2024-11-05",
      // Include method to decrypt auth token
      getDecryptedAuthToken: function () {
        return this.authToken ? decryptAuthToken(this.authToken) : null;
      },
    };

    console.log(`[PublicController] Starting scan for URL: ${url}`);

    // Perform uptime check
    const uptimeResult = await testMCPConnectionWithTools(tempMonitor);

    // Build uptime response
    const uptimeResponse = {
      status: uptimeResult.success ? "online" : "offline",
      responseTime: uptimeResult.responseTime,
      error: uptimeResult.error || null,
      tools: uptimeResult.tools || [],
    };

    // Perform security scan only if uptime check succeeded
    let securityResponse = null;

    if (uptimeResult.success) {
      try {
        const scanResult = await performPublicSecurityScan(tempMonitor);

        securityResponse = {
          riskLevel: scanResult.riskLevel,
          totalScanned: scanResult.total_scanned || 0,
          safeCount: scanResult.safe_count || 0,
          unsafeCount: scanResult.unsafe_count || 0,
          results: scanResult.results || [],
        };

        console.log(
          `[PublicController] Scan completed successfully - Risk: ${scanResult.riskLevel}`
        );
      } catch (scanError) {
        // Security scan failed, but we still have uptime results
        console.error(
          `[PublicController] Security scan failed:`,
          scanError.message
        );
        // Continue without security results
      }
    } else {
      console.log(
        `[PublicController] Skipping security scan - server is offline`
      );
    }

    // Return combined results
    return res.json({
      success: true,
      uptime: uptimeResponse,
      security: securityResponse,
    });
  } catch (error) {
    console.error(`[PublicController] Scan failed:`, error.message);

    // Return user-friendly error message
    return res.status(500).json({
      success: false,
      message: "Failed to scan server. Please try again later.",
      error:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}

export default {
  scanServer,
};
