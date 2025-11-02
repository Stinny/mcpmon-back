/**
 * Debug script to check monitoring setup
 */

import dotenv from "dotenv";
import connectDB from "../config/db.js";
import Monitor from "../models/Monitor.js";
import { checkAllMonitors } from "../services/monitoring.js";

dotenv.config();

async function debugMonitoring() {
  try {
    // Connect to database
    await connectDB();

    console.log("\n========================================");
    console.log("MONITORING DEBUG SCRIPT");
    console.log("========================================\n");

    // Check for monitors in the database
    const allMonitors = await Monitor.find({});
    console.log(`Total monitors in database: ${allMonitors.length}`);

    const activeMonitors = await Monitor.find({ isActive: true });
    console.log(`Active monitors: ${activeMonitors.length}\n`);

    if (allMonitors.length > 0) {
      console.log("Monitor details:");
      allMonitors.forEach((monitor, index) => {
        console.log(`\n${index + 1}. ${monitor.name}`);
        console.log(`   URL: ${monitor.url}`);
        console.log(`   Status: ${monitor.status}`);
        console.log(`   Active: ${monitor.isActive}`);
        console.log(`   Last checked: ${monitor.lastChecked || "Never"}`);
      });
    } else {
      console.log("\n⚠️  NO MONITORS FOUND IN DATABASE!");
      console.log("   This is why no checks are running.");
      console.log("   Please create a monitor through the UI or API first.\n");
      process.exit(0);
    }

    // Try running a check manually
    if (activeMonitors.length > 0) {
      console.log("\n\nRunning manual check...");
      console.log("========================================\n");

      const results = await checkAllMonitors();

      console.log("\n\n========================================");
      console.log("CHECK RESULTS");
      console.log("========================================");
      console.log(`Total: ${results.total}`);
      console.log(`Successful: ${results.successful}`);
      console.log(`Failed: ${results.failed}`);
      console.log("========================================\n");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

debugMonitoring();
