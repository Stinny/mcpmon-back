import axios from "axios";
import Monitor from "../models/Monitor.js";
import SecurityScan from "../models/SecurityScan.js";
import { sendSecurityAlert } from "./emailService.js";
import { broadcastSecurityUpdate } from "./websocket.js";

// Function to get scanner configuration (allows for runtime retrieval)
function getScannerConfig() {
  return {
    baseUrl: process.env.MCP_SCANNER_URL || "https://mcpscan.onrender.com",
    apiKey: process.env.MCP_SCANNER_API_KEY,
  };
}

// Default analyzers to use for scans
const DEFAULT_ANALYZERS = ["yara"];

/**
 * Scan a monitor's MCP server for security vulnerabilities
 * @param {Object} monitor - Monitor document from database
 * @param {Array} analyzers - Array of analyzer names to use
 * @returns {Object} Security scan document
 */
export async function scanMonitor(monitor, analyzers = DEFAULT_ANALYZERS) {
  const config = getScannerConfig();

  if (!config.apiKey) {
    const errorMsg =
      "MCP_SCANNER_API_KEY is not configured in environment variables";
    console.error(`[SecurityScanner] ${errorMsg}`);
    console.error(
      "[SecurityScanner] Available env keys:",
      Object.keys(process.env)
        .filter((k) => k.includes("MCP"))
        .join(", "),
    );
    throw new Error(errorMsg);
  }

  // Create initial scan record
  const scan = new SecurityScan({
    monitorId: monitor._id,
    userId: monitor.userId,
    status: "running",
    scanType: "tools",
    analyzers,
    scannedAt: new Date(),
  });

  try {
    await scan.save();

    // Prepare authentication for the target MCP server
    const auth = prepareAuthConfig(monitor);

    // Prepare request to scanner API
    const scanRequest = {
      server_url: monitor.url,
      auth,
      analyzers,
      output_format: "summary",
    };

    console.log(
      `[SecurityScanner] Starting scan for monitor: ${monitor.name} (${monitor._id})`,
    );
    console.log(`[SecurityScanner] Scanner URL: ${config.baseUrl}`);

    // Call MCP scanner API
    const response = await axios.post(
      `${config.baseUrl}/api/v1/scan/tools`,
      scanRequest,
      {
        headers: {
          "X-API-Key": config.apiKey,
          "Content-Type": "application/json",
        },
        timeout: 300000, // 5 minutes timeout
      },
    );

    // Process and save results
    const results = response.data;
    scan.results = results;
    scan.status = "completed";
    scan.completedAt = new Date();
    scan.duration = scan.completedAt - scan.scannedAt;

    // Calculate risk level based on findings
    scan.riskLevel = scan.calculateRiskLevel();

    await scan.save();

    // Update monitor's security status
    const previousStatus = monitor.securityStatus;
    monitor.securityStatus = scan.riskLevel;
    monitor.lastSecurityScan = new Date();

    // Reset alert counters if security status improved from high/critical
    if (
      (previousStatus === "high" || previousStatus === "critical") &&
      (scan.riskLevel === "safe" ||
        scan.riskLevel === "low" ||
        scan.riskLevel === "medium")
    ) {
      monitor.securityAlertDayCount = 0;
      monitor.securityAlertLastSentAt = null;
      monitor.securityAlertFirstDetectedAt = null;
      console.log(
        `[SecurityScanner] Security status improved for ${monitor.name}, reset alert counters`,
      );
    }

    await monitor.save();

    console.log(
      `[SecurityScanner] Scan completed for monitor: ${monitor.name} - Risk: ${scan.riskLevel}`,
    );

    // Send alerts if high-risk findings detected
    if (scan.riskLevel === "high" || scan.riskLevel === "critical") {
      await handleSecurityAlert(monitor, scan);
    }

    // Broadcast update via WebSocket
    if (broadcastSecurityUpdate) {
      broadcastSecurityUpdate(monitor.userId.toString(), {
        monitorId: monitor._id,
        monitorName: monitor.name,
        scanId: scan._id,
        riskLevel: scan.riskLevel,
        scannedAt: scan.scannedAt,
      });
    }

    return scan;
  } catch (error) {
    console.error(
      `[SecurityScanner] Scan failed for monitor: ${monitor.name}`,
      error.message,
    );

    // Update scan with error
    scan.status = "failed";
    scan.errorMessage = error.message || "Unknown error during scan";
    scan.completedAt = new Date();
    scan.duration = scan.completedAt - scan.scannedAt;
    await scan.save();

    throw error;
  }
}

/**
 * Prepare authentication configuration for the MCP server
 * @param {Object} monitor - Monitor document
 * @returns {Object} Auth configuration for scanner API
 */
function prepareAuthConfig(monitor) {
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
 * Handle security alert when high-risk findings are detected
 * Sends one email per day for up to 3 days
 * @param {Object} monitor - Monitor document
 * @param {Object} scan - SecurityScan document
 */
async function handleSecurityAlert(monitor, scan) {
  try {
    // Only send alerts if enabled and email is configured
    if (!monitor.alertsEnabled || !monitor.alertEmail) {
      return;
    }

    const now = new Date();

    // Check if we've already sent 3 days of alerts
    if (monitor.securityAlertDayCount >= 3) {
      console.log(
        `[SecurityScanner] Alert limit reached (3 days) for monitor: ${monitor.name}`,
      );
      return;
    }

    // Check if we should send an alert (one per day)
    let shouldSendAlert = false;

    if (!monitor.securityAlertLastSentAt) {
      // First alert for this issue
      shouldSendAlert = true;
    } else {
      // Check if at least 24 hours have passed since last alert
      const hoursSinceLastAlert =
        (now - monitor.securityAlertLastSentAt) / (1000 * 60 * 60);
      if (hoursSinceLastAlert >= 24) {
        shouldSendAlert = true;
      } else {
        console.log(
          `[SecurityScanner] Alert already sent today for monitor: ${monitor.name}`,
        );
        return;
      }
    }

    if (!shouldSendAlert) {
      return;
    }

    // Extract high severity findings
    const highSeverityFindings = [];
    if (scan.results && scan.results.results) {
      scan.results.results.forEach((result) => {
        if (result.findings) {
          const highFindings = result.findings.filter(
            (f) => f.severity === "HIGH",
          );
          highFindings.forEach((finding) => {
            highSeverityFindings.push({
              tool: result.tool_name,
              summary: finding.summary,
              analyzer: finding.analyzer,
            });
          });
        }
      });
    }

    // Send security alert email
    await sendSecurityAlert({
      email: monitor.alertEmail,
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      riskLevel: scan.riskLevel,
      totalScanned: scan.results.total_scanned,
      unsafeCount: scan.results.unsafe_count,
      highSeverityFindings,
      scanDate: scan.scannedAt,
    });

    // Update alert tracking
    if (!monitor.securityAlertFirstDetectedAt) {
      monitor.securityAlertFirstDetectedAt = now;
    }
    monitor.securityAlertLastSentAt = now;
    monitor.securityAlertDayCount += 1;
    await monitor.save();

    console.log(
      `[SecurityScanner] Alert sent to ${monitor.alertEmail} for monitor: ${monitor.name} (Day ${monitor.securityAlertDayCount}/3)`,
    );
  } catch (error) {
    console.error(
      `[SecurityScanner] Failed to send security alert:`,
      error.message,
    );
  }
}

/**
 * Get latest security scan for a monitor
 * @param {String} monitorId - Monitor ID
 * @returns {Object} Latest security scan or null
 */
export async function getLatestScan(monitorId) {
  try {
    return await SecurityScan.getLatestForMonitor(monitorId);
  } catch (error) {
    console.error(
      `[SecurityScanner] Error fetching latest scan:`,
      error.message,
    );
    return null;
  }
}

/**
 * Get scan history for a monitor
 * @param {String} monitorId - Monitor ID
 * @param {Number} limit - Number of scans to return
 * @returns {Array} Array of security scans
 */
export async function getScanHistory(monitorId, limit = 10) {
  try {
    return await SecurityScan.find({ monitorId })
      .sort({ scannedAt: -1 })
      .limit(limit)
      .select("-results.results.findings.details") // Exclude detailed findings for performance
      .exec();
  } catch (error) {
    console.error(
      `[SecurityScanner] Error fetching scan history:`,
      error.message,
    );
    return [];
  }
}

/**
 * Get security statistics for a user
 * @param {String} userId - User ID
 * @returns {Object} Security statistics
 */
export async function getUserSecurityStats(userId) {
  try {
    return await SecurityScan.getUserStats(userId);
  } catch (error) {
    console.error(
      `[SecurityScanner] Error fetching user security stats:`,
      error.message,
    );
    return {
      totalScans: 0,
      safe: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
      lastScanDate: null,
    };
  }
}

/**
 * Check if a monitor needs a security scan
 * @param {Object} monitor - Monitor document
 * @returns {Boolean} True if scan is needed
 */
export function needsSecurityScan(monitor) {
  if (!monitor.securityScanEnabled || !monitor.isActive) {
    return false;
  }

  // If never scanned, needs scan
  if (!monitor.lastSecurityScan) {
    return true;
  }

  // Check if scan interval has passed
  const hoursSinceLastScan =
    (Date.now() - monitor.lastSecurityScan.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastScan >= monitor.securityScanInterval;
}

/**
 * Scan all monitors that need security scanning
 * @returns {Object} Summary of scan operations
 */
export async function scanAllMonitors() {
  try {
    console.log("[SecurityScanner] Starting scheduled security scans...");

    // Find all active monitors that need scanning
    const monitors = await Monitor.find({
      isActive: true,
      securityScanEnabled: true,
    }).select("+authToken"); // Include authToken for decryption

    const summary = {
      total: monitors.length,
      scanned: 0,
      failed: 0,
      skipped: 0,
      results: {},
    };

    for (const monitor of monitors) {
      try {
        // Check if scan is needed
        if (!needsSecurityScan(monitor)) {
          summary.skipped++;
          continue;
        }

        // Perform scan
        const scan = await scanMonitor(monitor);
        summary.scanned++;

        // Track results by risk level
        const riskLevel = scan.riskLevel;
        summary.results[riskLevel] = (summary.results[riskLevel] || 0) + 1;

        // Add delay between scans to avoid overwhelming the scanner API
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(
          `[SecurityScanner] Failed to scan monitor ${monitor.name}:`,
          error.message,
        );
        summary.failed++;
      }
    }

    console.log("[SecurityScanner] Scheduled scans completed:", summary);
    return summary;
  } catch (error) {
    console.error("[SecurityScanner] Error in scanAllMonitors:", error.message);
    throw error;
  }
}

export default {
  scanMonitor,
  getLatestScan,
  getScanHistory,
  getUserSecurityStats,
  needsSecurityScan,
  scanAllMonitors,
};
