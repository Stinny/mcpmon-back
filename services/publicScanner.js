import axios from "axios";

/**
 * Get scanner configuration
 * @returns {Object} Scanner configuration
 */
function getScannerConfig() {
  return {
    baseUrl: process.env.MCP_SCANNER_URL || "https://mcpscan.onrender.com",
    apiKey: process.env.MCP_SCANNER_API_KEY,
  };
}

// Default analyzers to use for scans
const DEFAULT_ANALYZERS = ["yara"];

/**
 * Prepare authentication configuration for the MCP server
 * Extracted from securityScanner.js for reuse in public scans
 * @param {Object} monitor - Monitor-like object with auth details
 * @returns {Object} Auth configuration for scanner API
 */
export function prepareAuthConfig(monitor) {
  if (!monitor.requiresAuth) {
    return { type: "none" };
  }

  const decryptedToken = monitor.getDecryptedAuthToken();
  const headerName = monitor.authHeader || "Authorization";

  // If using standard Authorization header, send as bearer token
  if (headerName === "Authorization") {
    return {
      type: "bearer",
      bearer_token: decryptedToken,
    };
  }

  // Otherwise send as API key with custom header
  return {
    type: "apikey",
    api_key: decryptedToken,
    api_key_header: headerName,
  };
}

/**
 * Calculate risk level based on findings
 * Extracted from SecurityScan model for reuse in public scans
 * @param {Object} results - Scan results from scanner API
 * @returns {String} Risk level: safe, low, medium, high, critical
 */
export function calculateRiskLevel(results) {
  if (!results || !results.results || results.results.length === 0) {
    return "safe";
  }

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  results.results.forEach((result) => {
    if (result.findings) {
      result.findings.forEach((finding) => {
        if (finding.severity === "HIGH") highCount++;
        else if (finding.severity === "MEDIUM") mediumCount++;
        else if (finding.severity === "LOW") lowCount++;
      });
    }
  });

  // Determine overall risk level
  if (highCount >= 3) return "critical";
  if (highCount >= 1) return "high";
  if (mediumCount >= 3) return "medium";
  if (mediumCount >= 1 || lowCount >= 3) return "low";
  return "safe";
}

/**
 * Perform a public security scan without database operations
 * This is for one-time scans from the landing page
 * @param {Object} tempMonitor - Temporary monitor-like object
 * @param {Array} analyzers - Array of analyzer names to use
 * @returns {Promise<Object>} Scan results with risk level
 */
export async function performPublicSecurityScan(
  tempMonitor,
  analyzers = DEFAULT_ANALYZERS
) {
  const config = getScannerConfig();

  if (!config.apiKey) {
    throw new Error("MCP_SCANNER_API_KEY is not configured");
  }

  try {
    // Prepare authentication for the target MCP server
    const auth = prepareAuthConfig(tempMonitor);

    // Prepare request to scanner API
    const scanRequest = {
      server_url: tempMonitor.url,
      auth,
      analyzers,
      output_format: "summary",
    };

    console.log(
      `[PublicScanner] Starting public scan for URL: ${tempMonitor.url}`
    );

    // Call MCP scanner API
    const response = await axios.post(
      `${config.baseUrl}/api/v1/scan/tools`,
      scanRequest,
      {
        headers: {
          "X-API-Key": config.apiKey,
          "Content-Type": "application/json",
        },
        timeout: 120000, // 2 minutes timeout (shorter than regular scans)
      }
    );

    const results = response.data;

    // Calculate risk level
    const riskLevel = calculateRiskLevel(results);

    console.log(`[PublicScanner] Public scan completed - Risk: ${riskLevel}`);

    return {
      ...results,
      riskLevel,
    };
  } catch (error) {
    console.error(
      `[PublicScanner] Public scan failed for URL: ${tempMonitor.url}`,
      error.message
    );
    throw error;
  }
}

export default {
  performPublicSecurityScan,
  prepareAuthConfig,
  calculateRiskLevel,
};
