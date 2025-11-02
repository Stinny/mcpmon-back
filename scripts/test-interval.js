/**
 * Test setInterval to verify it works
 */

console.log("Testing setInterval...");
console.log(`Current time: ${new Date().toISOString()}\n`);

let count = 0;

// Set interval to run every 5 seconds
const interval = setInterval(() => {
  count++;
  console.log(`[${new Date().toISOString()}] ⏰ Interval fired! Count: ${count}`);

  if (count >= 3) {
    console.log("\n✅ setInterval is working! Stopping test...");
    clearInterval(interval);
    process.exit(0);
  }
}, 5000);

console.log("✓ Interval scheduled to run every 5 seconds");
console.log("✓ Waiting for 3 executions...\n");

// Timeout after 20 seconds
setTimeout(() => {
  console.log("\n❌ Timeout - interval did not fire as expected");
  console.log(`Total executions: ${count}`);
  clearInterval(interval);
  process.exit(1);
}, 20000);
