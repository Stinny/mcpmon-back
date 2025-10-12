/**
 * Test Monitoring Script
 * Creates test monitors and runs checks to verify functionality
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import Monitor from "../models/Monitor.js";
import { checkSingleMonitor, checkAllMonitors } from "../services/monitoring.js";
import { testMCPConnection } from "../services/mcp-client.js";

// Load environment variables
dotenv.config();

// Test configuration
const TEST_MONITORS = [
  {
    name: "Test HTTP Server",
    url: "http://httpbin.org/post", // Public test endpoint
    httpMethod: "POST",
    timeout: 10,
    retryAttempts: 1,
    requestHeaders: {
      "Content-Type": "application/json",
    },
    requestBody: {
      jsonrpc: "2.0",
      id: "test-1",
      method: "ping",
    },
  },
  {
    name: "Test Invalid Server",
    url: "http://localhost:9999/nonexistent", // Should fail
    httpMethod: "POST",
    timeout: 5,
    retryAttempts: 1,
  },
];

async function testMCPClient() {
  console.log("\n=== Testing MCP Client ===\n");

  for (const config of TEST_MONITORS) {
    console.log(`Testing: ${config.name}`);
    console.log(`URL: ${config.url}`);

    const result = await testMCPConnection(config);

    console.log(`Result:`, {
      success: result.success,
      responseTime: `${result.responseTime}ms`,
      error: result.error || "None",
      type: result.type || "N/A",
    });
    console.log("---\n");
  }
}

async function createTestMonitor(userId) {
  console.log("\n=== Creating Test Monitor ===\n");

  // Check if test monitor already exists
  let monitor = await Monitor.findOne({ name: "Test Monitor - Delete Me" });

  if (monitor) {
    console.log("Test monitor already exists, using existing one");
    console.log(`Monitor ID: ${monitor._id}`);
    return monitor;
  }

  // Create a new test monitor
  monitor = new Monitor({
    name: "Test Monitor - Delete Me",
    url: "http://httpbin.org/post",
    userId: userId || new mongoose.Types.ObjectId(),
    httpMethod: "POST",
    timeout: 10,
    checkInterval: 5,
    retryAttempts: 1,
    requestHeaders: {
      "Content-Type": "application/json",
    },
    requestBody: {
      jsonrpc: "2.0",
      id: "health-check",
      method: "ping",
    },
    description: "Test monitor for development",
    isActive: true,
  });

  await monitor.save();
  console.log(`✓ Created test monitor: ${monitor._id}`);
  console.log(`  Name: ${monitor.name}`);
  console.log(`  URL: ${monitor.url}`);

  return monitor;
}

async function testSingleMonitor(monitor) {
  console.log("\n=== Testing Single Monitor Check ===\n");

  const result = await checkSingleMonitor(monitor);

  console.log("Check Result:", {
    name: result.name,
    status: result.status,
    isUp: result.isUp,
    responseTime: `${result.responseTime}ms`,
    error: result.error || "None",
  });

  // Reload monitor to see updated fields
  await monitor.reload();

  console.log("\nUpdated Monitor Stats:", {
    status: monitor.status,
    totalChecks: monitor.totalChecks,
    failedChecks: monitor.failedChecks,
    uptimePercentage: `${monitor.uptimePercentage}%`,
    averageResponseTime: `${monitor.averageResponseTime}ms`,
    lastChecked: monitor.lastChecked?.toISOString(),
    lastUptime: monitor.lastUptime?.toISOString(),
    lastError: monitor.lastError,
  });
}

async function testAllMonitors() {
  console.log("\n=== Testing Check All Monitors ===\n");

  const summary = await checkAllMonitors();

  console.log("\nSummary:", {
    total: summary.total,
    successful: summary.successful,
    failed: summary.failed,
  });

  console.log("\nDetailed Results:");
  summary.results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.name}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Response Time: ${result.responseTime}ms`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
}

async function cleanupTestMonitor() {
  console.log("\n=== Cleanup ===\n");

  const result = await Monitor.deleteMany({
    name: { $regex: /^Test Monitor - Delete Me/i },
  });

  console.log(`Deleted ${result.deletedCount} test monitor(s)`);
}

async function main() {
  try {
    console.log("\n========================================");
    console.log("Monitoring System Test Suite");
    console.log(`Started: ${new Date().toISOString()}`);
    console.log("========================================");

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    console.log("\nConnecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✓ Database connected successfully");

    // Test 1: MCP Client direct testing
    await testMCPClient();

    // Test 2: Create a test monitor
    const monitor = await createTestMonitor();

    // Test 3: Test single monitor check
    await testSingleMonitor(monitor);

    // Test 4: Test checking all monitors
    await testAllMonitors();

    // Cleanup (optional - comment out if you want to keep test data)
    const cleanup = process.argv.includes("--cleanup");
    if (cleanup) {
      await cleanupTestMonitor();
    } else {
      console.log("\n💡 Tip: Run with --cleanup flag to remove test monitors");
    }

    console.log("\n========================================");
    console.log("All tests completed successfully!");
    console.log(`Finished: ${new Date().toISOString()}`);
    console.log("========================================\n");

    // Close database connection
    await mongoose.connection.close();
    console.log("✓ Database connection closed\n");

    process.exit(0);
  } catch (error) {
    console.error("\n========================================");
    console.error("TEST FAILED");
    console.error(`Time: ${new Date().toISOString()}`);
    console.error("========================================");
    console.error(error);
    console.error("========================================\n");

    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
      }
    } catch (closeError) {
      console.error("Failed to close database connection:", closeError);
    }

    process.exit(1);
  }
}

// Run the test suite
main();
