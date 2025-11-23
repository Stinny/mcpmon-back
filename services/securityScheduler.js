import cron from 'node-cron';
import { scanAllMonitors } from './securityScanner.js';

let securityScanJob = null;
let isRunning = false;
let lastRunTime = null;
let lastRunSummary = null;

/**
 * Start the security scan scheduler
 * Runs every 30 minutes
 */
export function startSecurityScheduler() {
  if (securityScanJob) {
    console.log('[SecurityScheduler] Security scheduler is already running');
    return;
  }

  // Schedule security scans to run every 30 minutes
  // Cron pattern: '*/30 * * * *' = Every 30 minutes
  securityScanJob = cron.schedule('*/30 * * * *', async () => {
    if (isRunning) {
      console.log('[SecurityScheduler] Previous scan still running, skipping...');
      return;
    }

    try {
      isRunning = true;
      lastRunTime = new Date();

      console.log(`[SecurityScheduler] Starting scheduled security scans at ${lastRunTime.toISOString()}`);

      const summary = await scanAllMonitors();
      lastRunSummary = summary;

      console.log('[SecurityScheduler] Scheduled security scans completed:', summary);
    } catch (error) {
      console.error('[SecurityScheduler] Error during scheduled security scan:', error);
      lastRunSummary = { error: error.message };
    } finally {
      isRunning = false;
    }
  }, {
    scheduled: true,
    timezone: 'UTC'
  });

  console.log('[SecurityScheduler] Security scan scheduler started - runs every 30 minutes');
}

/**
 * Stop the security scan scheduler
 */
export function stopSecurityScheduler() {
  if (securityScanJob) {
    securityScanJob.stop();
    securityScanJob = null;
    console.log('[SecurityScheduler] Security scan scheduler stopped');
  } else {
    console.log('[SecurityScheduler] Security scan scheduler is not running');
  }
}

/**
 * Run security scans immediately (outside of schedule)
 * @returns {Object} Summary of scan results
 */
export async function runImmediateSecurityScan() {
  if (isRunning) {
    throw new Error('Security scan is already running');
  }

  try {
    isRunning = true;
    lastRunTime = new Date();

    console.log(`[SecurityScheduler] Running immediate security scan at ${lastRunTime.toISOString()}`);

    const summary = await scanAllMonitors();
    lastRunSummary = summary;

    console.log('[SecurityScheduler] Immediate security scan completed:', summary);
    return summary;
  } catch (error) {
    console.error('[SecurityScheduler] Error during immediate security scan:', error);
    lastRunSummary = { error: error.message };
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Get the status of the security scheduler
 * @returns {Object} Scheduler status information
 */
export function getSecuritySchedulerStatus() {
  return {
    isScheduled: securityScanJob !== null,
    isRunning,
    lastRunTime,
    lastRunSummary,
    schedule: '*/30 * * * * (Every 30 minutes)'
  };
}

/**
 * Restart the security scheduler
 */
export function restartSecurityScheduler() {
  stopSecurityScheduler();
  startSecurityScheduler();
  console.log('[SecurityScheduler] Security scan scheduler restarted');
}

export default {
  startSecurityScheduler,
  stopSecurityScheduler,
  runImmediateSecurityScan,
  getSecuritySchedulerStatus,
  restartSecurityScheduler
};
