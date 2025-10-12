/**
 * Scheduler Service
 * Manages cron jobs for periodic monitor checks
 */

import cron from "node-cron";
import { checkAllMonitors } from "./monitoring.js";

let monitorCheckJob = null;

/**
 * Start the monitor check cron job
 * Runs every 1 minute by default
 */
export function startScheduler(cronExpression = "* * * * *") {
  // Stop existing job if running
  if (monitorCheckJob) {
    console.log("Stopping existing monitor check scheduler...");
    monitorCheckJob.stop();
  }

  // Validate cron expression
  if (!cron.validate(cronExpression)) {
    throw new Error(`Invalid cron expression: ${cronExpression}`);
  }

  console.log(`\n========================================`);
  console.log(`Starting Monitor Check Scheduler`);
  console.log(`Schedule: ${cronExpression} (every 1 minute)`);
  console.log(`Started at: ${new Date().toISOString()}`);
  console.log(`========================================\n`);

  // Create and start the cron job
  monitorCheckJob = cron.schedule(
    cronExpression,
    async () => {
      console.log(
        `\n[${new Date().toISOString()}] Running scheduled monitor checks...`,
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
    },
    {
      scheduled: true,
      timezone: "America/New_York", // Change to your timezone
    },
  );

  console.log("✓ Monitor check scheduler started successfully");
  console.log("  Monitors will be checked every 1 minute\n");

  return monitorCheckJob;
}

/**
 * Stop the monitor check cron job
 */
export function stopScheduler() {
  if (monitorCheckJob) {
    console.log("\nStopping monitor check scheduler...");
    monitorCheckJob.stop();
    monitorCheckJob = null;
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
    isRunning: monitorCheckJob !== null,
    job: monitorCheckJob,
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
