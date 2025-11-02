/**
 * Scheduler Service
 * Manages periodic monitor checks using setInterval
 */

import { checkAllMonitors } from "./monitoring.js";

let monitorCheckInterval = null;

/**
 * Start the monitor check scheduler
 * Runs every 1 minute by default
 * @param {number} intervalMinutes - Interval in minutes (default: 1)
 */
export function startScheduler(intervalMinutes = 1) {
  // Stop existing interval if running
  if (monitorCheckInterval) {
    console.log("Stopping existing monitor check scheduler...");
    clearInterval(monitorCheckInterval);
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`\n========================================`);
  console.log(`Starting Monitor Check Scheduler`);
  console.log(`Interval: Every ${intervalMinutes} minute(s)`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  // Create and start the interval
  monitorCheckInterval = setInterval(async () => {
    console.log(
      `\n[${new Date().toISOString()}] 🔔 SCHEDULER TRIGGERED - Running scheduled monitor checks...`,
    );

    try {
      const results = await checkAllMonitors();

      console.log(`[${new Date().toISOString()}] Check completed:`, {
        total: results.total,
        successful: results.successful,
        failed: results.failed,
      });
    } catch (error) {
      console.error(
        `[${new Date().toISOString()}] Scheduled check failed:`,
        error,
      );
    }
  }, intervalMs);

  console.log("✓ Monitor check scheduler started successfully");
  console.log(`✓ Interval set: ${intervalMs}ms (${intervalMinutes} minute(s))`);
  console.log(`✓ Next execution in ${intervalMinutes} minute(s)`);
  console.log(`✓ Scheduler will run every ${intervalMinutes} minute(s)\n`);

  return monitorCheckInterval;
}

/**
 * Stop the monitor check scheduler
 */
export function stopScheduler() {
  if (monitorCheckInterval) {
    console.log("\nStopping monitor check scheduler...");
    clearInterval(monitorCheckInterval);
    monitorCheckInterval = null;
    console.log("✓ Monitor check scheduler stopped\n");
    return true;
  }

  console.log("No active scheduler to stop");
  return false;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    isRunning: monitorCheckInterval !== null,
    interval: monitorCheckInterval,
  };
}

/**
 * Run an immediate check (outside of schedule)
 */
export async function runImmediateCheck() {
  console.log(`\n[${new Date().toISOString()}] Running immediate check...`);

  try {
    const results = await checkAllMonitors();
    console.log(`[${new Date().toISOString()}] Immediate check completed:`, {
      total: results.total,
      successful: results.successful,
      failed: results.failed,
    });
    return results;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Immediate check failed:`,
      error,
    );
    throw error;
  }
}
