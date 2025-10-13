/**
 * Monitoring Service
 * Handles periodic health checks for MCP servers
 */

import Monitor from "../models/Monitor.js";
import { testMCPConnection } from "./mcp-client.js";
import { broadcastMonitorUpdate } from "./websocket.js";

/**
 * Check a single monitor's health
 * @param {Object} monitor - Monitor document from MongoDB
 * @returns {Promise<Object>} - Result with status, responseTime, and error if any
 */
export async function checkSingleMonitor(monitor) {
  const startTime = Date.now();

  try {
    // Test the MCP server connection
    const result = await testMCPConnection(monitor);
    const responseTime = Date.now() - startTime;

    // Determine if the check was successful
    const isUp = result.success;

    // Update monitor document
    monitor.lastChecked = new Date();
    monitor.totalChecks += 1;

    if (isUp) {
      monitor.status = "online";
      monitor.lastUptime = new Date();
      monitor.responseTime = responseTime;

      // Handle warnings (e.g., HTTP errors like 4xx, 5xx)
      if (result.warning) {
        monitor.lastError = result.warning;
        console.log(
          `⚠ Monitor "${monitor.name}" is UP but returned: ${result.warning} (${responseTime}ms)`,
        );
      } else {
        monitor.lastError = null;
        console.log(`✓ Monitor "${monitor.name}" is UP (${responseTime}ms)`);
      }

      // Calculate successfulChecks
      const successfulChecks = monitor.totalChecks - monitor.failedChecks;
      // Note: We don't have a successfulChecks field in the schema, so we derive it
    } else {
      monitor.status = "offline";
      monitor.responseTime = responseTime;
      monitor.lastError = result.error || "Connection failed";
      monitor.failedChecks += 1;

      // Log failure
      console.log(
        `✗ Monitor "${monitor.name}" is OFFLINE (${responseTime}ms) - ${monitor.lastError}`,
      );
    }

    // Update average response time using the model's method
    if (isUp) {
      if (monitor.totalChecks === 1) {
        monitor.averageResponseTime = responseTime;
      } else {
        monitor.averageResponseTime = Math.round(
          (monitor.averageResponseTime * (monitor.totalChecks - 1) +
            responseTime) /
            monitor.totalChecks,
        );
      }
    }

    // Calculate uptime percentage
    monitor.uptimePercentage = monitor.calculateUptime();

    // Update auth status if present in the check result
    if (result.authStatus) {
      monitor.authStatus = result.authStatus;
      monitor.lastAuthCheckAt = new Date();

      // Update auth error message
      if (result.authError && result.warning) {
        monitor.authErrorMessage = result.warning;
      } else if (
        result.authStatus === "valid" ||
        result.authStatus === "not-required"
      ) {
        monitor.authErrorMessage = null; // Clear error on successful auth or when auth not required
      } else if (result.authStatus === "untested" && result.warning) {
        monitor.authErrorMessage = result.warning; // Store the 401/403 message
      }
    }

    // Save the updated monitor
    await monitor.save();

    const checkResult = {
      monitorId: monitor._id,
      name: monitor.name,
      status: monitor.status,
      responseTime,
      isUp,
      error: result.error,
      warning: result.warning,
      statusCode: result.statusCode,
      authStatus: monitor.authStatus,
      authErrorMessage: monitor.authErrorMessage,
    };

    // Broadcast update to WebSocket clients
    broadcastMonitorUpdate(monitor.userId, {
      _id: monitor._id,
      name: monitor.name,
      url: monitor.url,
      status: monitor.status,
      responseTime: monitor.responseTime,
      averageResponseTime: monitor.averageResponseTime,
      uptimePercentage: monitor.uptimePercentage,
      totalChecks: monitor.totalChecks,
      lastChecked: monitor.lastChecked,
      lastError: monitor.lastError,
      authStatus: monitor.authStatus,
      authErrorMessage: monitor.authErrorMessage,
      lastAuthCheckAt: monitor.lastAuthCheckAt,
    });

    return checkResult;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Update monitor with error
    monitor.lastChecked = new Date();
    monitor.totalChecks += 1;
    monitor.status = "offline";
    monitor.responseTime = responseTime;
    monitor.lastError = error.message;
    monitor.failedChecks += 1;
    monitor.uptimePercentage = monitor.calculateUptime();

    await monitor.save();

    console.error(`✗ Monitor "${monitor.name}" check failed: ${error.message}`);

    const errorResult = {
      monitorId: monitor._id,
      name: monitor.name,
      status: "offline",
      responseTime,
      isUp: false,
      error: error.message,
    };

    // Broadcast error update to WebSocket clients
    broadcastMonitorUpdate(monitor.userId, {
      _id: monitor._id,
      name: monitor.name,
      url: monitor.url,
      status: monitor.status,
      responseTime: monitor.responseTime,
      averageResponseTime: monitor.averageResponseTime,
      uptimePercentage: monitor.uptimePercentage,
      totalChecks: monitor.totalChecks,
      lastChecked: monitor.lastChecked,
      lastError: monitor.lastError,
    });

    return errorResult;
  }
}

/**
 * Check all active monitors in parallel
 * @returns {Promise<Object>} - Summary with successful and failed counts
 */
export async function checkAllMonitors() {
  try {
    // Query all active monitors from the database
    const monitors = await Monitor.find({ isActive: true });

    if (monitors.length === 0) {
      console.log("No active monitors to check");
      return {
        successful: 0,
        failed: 0,
        total: 0,
        results: [],
      };
    }

    console.log(`\nChecking ${monitors.length} active monitor(s)...`);

    // Check all monitors in parallel using Promise.allSettled
    const results = await Promise.allSettled(
      monitors.map((monitor) => checkSingleMonitor(monitor)),
    );

    // Process results and count successes/failures
    let successful = 0;
    let failed = 0;
    const checkResults = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        const checkResult = result.value;
        checkResults.push(checkResult);

        if (checkResult.isUp) {
          successful++;
        } else {
          failed++;
        }
      } else {
        // Promise was rejected
        failed++;
        console.error(
          `Failed to check monitor ${monitors[index].name}: ${result.reason}`,
        );
        checkResults.push({
          monitorId: monitors[index]._id,
          name: monitors[index].name,
          status: "offline",
          isUp: false,
          error: result.reason?.message || "Unknown error",
        });
      }
    });

    // Log summary
    console.log(`\n--- Check Summary ---`);
    console.log(`Total monitors checked: ${monitors.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`-------------------\n`);

    return {
      successful,
      failed,
      total: monitors.length,
      results: checkResults,
    };
  } catch (error) {
    console.error("Error in checkAllMonitors:", error);
    throw error;
  }
}
