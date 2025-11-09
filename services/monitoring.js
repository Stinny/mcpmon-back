/**
 * Monitoring Service
 * Handles periodic health checks for MCP servers
 */

import Monitor from "../models/Monitor.js";
import User from "../models/User.js";
import { testMCPConnectionWithTools } from "./mcp-client.js";
import { broadcastMonitorUpdate } from "./websocket.js";
import {
  sendMonitorDownAlert,
  sendMonitorRecoveryAlert,
  shouldSendDailyReminder,
} from "./emailService.js";
import { sendMonitorDownSMS, sendMonitorRecoverySMS } from "./smsService.js";

/**
 * Check a single monitor's health
 * @param {Object} monitor - Monitor document from MongoDB
 * @returns {Promise<Object>} - Result with status, responseTime, and error if any
 */
export async function checkSingleMonitor(monitor) {
  const startTime = Date.now();

  try {
    // Capture previous state for status transition detection
    const previousStatus = monitor.status;
    const previousConsecutiveFailures = monitor.consecutiveFailures || 0;

    // Test the MCP server connection with tool discovery
    const result = await testMCPConnectionWithTools(monitor);
    const responseTime = result.responseTime || Date.now() - startTime;

    // Determine if the check was successful
    const isUp = result.success;

    // Update tools based on discovery result
    if (monitor.toolsSyncEnabled) {
      if (isUp) {
        // Server is up - update tools (even if empty)
        if (result.tools && result.tools.length > 0) {
          monitor.tools = result.tools;
          monitor.lastToolsSync = new Date();
          console.log(
            `🔧 Discovered ${result.tools.length} tools for monitor "${monitor.name}"`,
          );
        } else {
          // Server is up but no tools discovered - clear tools array
          monitor.tools = [];
          monitor.lastToolsSync = new Date();
          console.log(`🔧 No tools discovered for monitor "${monitor.name}"`);
        }
      } else {
        // Server is offline - clear tools array
        monitor.tools = [];
        monitor.lastToolsSync = new Date();
        console.log(
          `🔧 Cleared tools for offline monitor "${monitor.name}"`,
        );
      }
    } else if (result.tools && result.tools.length > 0) {
      // Tools sync not enabled but tools were discovered anyway (shouldn't happen normally)
      monitor.tools = result.tools;
      monitor.lastToolsSync = new Date();
      console.log(
        `🔧 Discovered ${result.tools.length} tools for monitor "${monitor.name}"`,
      );
    }

    // Update monitor document
    monitor.lastCheckedAt = new Date();
    monitor.totalChecks += 1;

    let statusChanged = false;

    if (isUp) {
      // Server is online
      const wasOffline = previousStatus === "offline";

      monitor.status = "online";
      monitor.lastUptime = new Date();
      monitor.responseTime = responseTime;
      monitor.consecutiveFailures = 0; // Reset consecutive failures

      // Detect offline -> online transition (recovery)
      if (wasOffline) {
        statusChanged = true;
        monitor.lastStatusChangeAt = new Date();

        // Calculate downtime duration for recovery email
        const downtimeDuration =
          monitor.lastStatusChangeAt - monitor.lastDowntime;

        // Send recovery alerts if enabled
        if (monitor.alertsEnabled && monitor.notifyOnRecovery) {
          try {
            const user = await User.findById(monitor.userId);
            if (user) {
              // Send email alert
              await sendMonitorRecoveryAlert(monitor, user, downtimeDuration);
              console.log(
                `📧 Recovery email sent for monitor "${monitor.name}"`,
              );

              // Send SMS alert
              const smsResult = await sendMonitorRecoverySMS(
                monitor,
                user,
                downtimeDuration,
              );
              if (smsResult) {
                console.log(
                  `📱 Recovery SMS sent for monitor "${monitor.name}"`,
                );
              } else {
                console.log(
                  `📱 Recovery SMS skipped for monitor "${monitor.name}" (check SMS Service logs)`,
                );
              }
            }
          } catch (alertError) {
            console.error(
              `Failed to send recovery alerts for ${monitor.name}:`,
              alertError,
            );
          }
        }

        // Reset alert tracking on recovery
        monitor.alertsSentCount = 0;
        monitor.lastAlertSentAt = null;
      }

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
    } else {
      // Server is offline
      const wasOnline = previousStatus === "online";

      monitor.status = "offline";
      monitor.responseTime = responseTime;
      monitor.lastError = result.error || "Connection failed";
      monitor.failedChecks += 1;
      monitor.consecutiveFailures += 1;

      // Detect online -> offline transition
      if (wasOnline) {
        statusChanged = true;
        monitor.lastStatusChangeAt = new Date();
        monitor.lastDowntime = new Date();
      }

      // Send initial downtime alert after 2-3 consecutive failures
      const shouldSendInitialAlert =
        monitor.consecutiveFailures >= 2 && previousConsecutiveFailures < 2;

      if (shouldSendInitialAlert && monitor.alertsEnabled) {
        try {
          const user = await User.findById(monitor.userId);
          if (user) {
            // Send email alert
            await sendMonitorDownAlert(monitor, user, false);
            console.log(
              `📧 Initial downtime email sent for monitor "${monitor.name}"`,
            );

            // Send SMS alert
            const smsResult = await sendMonitorDownSMS(monitor, user, false);
            if (smsResult) {
              console.log(
                `📱 Initial downtime SMS sent for monitor "${monitor.name}"`,
              );
            } else {
              console.log(
                `📱 Initial downtime SMS skipped for monitor "${monitor.name}" (check SMS Service logs)`,
              );
            }

            monitor.lastAlertSentAt = new Date();
            monitor.alertsSentCount = 1;
          }
        } catch (alertError) {
          console.error(
            `Failed to send downtime alerts for ${monitor.name}:`,
            alertError,
          );
        }
      }

      // Log failure
      console.log(
        `✗ Monitor "${monitor.name}" is OFFLINE (${responseTime}ms) - ${monitor.lastError}`,
      );
    }

    // Check if daily reminder should be sent (for monitors still offline)
    if (monitor.status === "offline" && shouldSendDailyReminder(monitor)) {
      try {
        const user = await User.findById(monitor.userId);
        if (user) {
          // Send email reminder
          await sendMonitorDownAlert(monitor, user, true); // isReminder = true
          console.log(
            `📧 Daily reminder email sent for monitor "${monitor.name}" (alert #${monitor.alertsSentCount + 1})`,
          );

          // Send SMS reminder
          const smsResult = await sendMonitorDownSMS(monitor, user, true); // isReminder = true
          if (smsResult) {
            console.log(
              `📱 Daily reminder SMS sent for monitor "${monitor.name}" (alert #${monitor.alertsSentCount + 1})`,
            );
          } else {
            console.log(
              `📱 Daily reminder SMS skipped for monitor "${monitor.name}" (check SMS Service logs)`,
            );
          }

          monitor.lastAlertSentAt = new Date();
          monitor.alertsSentCount += 1;
        }
      } catch (alertError) {
        console.error(
          `Failed to send reminder alerts for ${monitor.name}:`,
          alertError,
        );
      }
    }

    // Update average response time
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
      statusChanged,
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
      lastCheckedAt: monitor.lastCheckedAt,
      lastError: monitor.lastError,
      consecutiveFailures: monitor.consecutiveFailures,
    });

    return checkResult;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const previousStatus = monitor.status;

    // Update monitor with error
    monitor.lastCheckedAt = new Date();
    monitor.totalChecks += 1;
    monitor.status = "offline";
    monitor.responseTime = responseTime;
    monitor.lastError = error.message;
    monitor.failedChecks += 1;
    monitor.consecutiveFailures += 1;
    monitor.uptimePercentage = monitor.calculateUptime();

    // Track status change for exception case
    if (previousStatus !== "offline") {
      monitor.lastStatusChangeAt = new Date();
      monitor.lastDowntime = new Date();
    }

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
      lastCheckedAt: monitor.lastCheckedAt,
      lastError: monitor.lastError,
      consecutiveFailures: monitor.consecutiveFailures,
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
    // Query all active monitors from the database (include authToken for decryption)
    const monitors = await Monitor.find({ isActive: true }).select(
      "+authToken",
    );

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
