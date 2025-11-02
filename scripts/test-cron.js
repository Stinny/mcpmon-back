/**
 * Simple test to verify node-cron is working
 */

import cron from "node-cron";

console.log("Testing node-cron...");
console.log(`Current time: ${new Date().toISOString()}\n`);

let count = 0;

// Schedule a job to run every 10 seconds
const job = cron.schedule("*/10 * * * * *", () => {
  count++;
  console.log(`[${new Date().toISOString()}] 🔔 Cron fired! Count: ${count}`);

  if (count >= 3) {
    console.log("\n✅ Cron is working! Stopping test...");
    job.stop();
    process.exit(0);
  }
}, {
  scheduled: true,
});

console.log("✓ Cron job scheduled to run every 10 seconds");
console.log("✓ Waiting for 3 executions...\n");

// Timeout after 40 seconds
setTimeout(() => {
  console.log("\n❌ Timeout - cron did not fire as expected");
  console.log(`Total executions: ${count}`);
  job.stop();
  process.exit(1);
}, 40000);
