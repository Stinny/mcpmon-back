/**
 * Run Checks Script
 * Entry point for the cron job that checks all active monitors
 * This script runs once and exits cleanly
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { checkAllMonitors } from "../services/monitoring.js";

// Load environment variables
dotenv.config();

/**
 * Main function to run monitor checks
 */
async function main() {
  try {
    // Log start time
    console.log(`\n========================================`);
    console.log(`Monitor Check Started: ${new Date().toISOString()}`);
    console.log(`========================================`);

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }

    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    console.log("✓ Database connected successfully\n");

    // Run monitor checks
    const results = await checkAllMonitors();

    // Log results
    console.log("\n========================================");
    console.log("Check Results:");
    console.log(JSON.stringify(results, null, 2));
    console.log(`========================================`);
    console.log(`Monitor Check Completed: ${new Date().toISOString()}`);
    console.log(`========================================\n`);

    // Close database connection
    await mongoose.connection.close();
    console.log("✓ Database connection closed\n");

    // Exit successfully
    process.exit(0);
  } catch (error) {
    console.error("\n========================================");
    console.error("ERROR: Monitor check failed");
    console.error(`Time: ${new Date().toISOString()}`);
    console.error("========================================");
    console.error(error);
    console.error("========================================\n");

    // Attempt to close database connection
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log("✓ Database connection closed\n");
      }
    } catch (closeError) {
      console.error("Failed to close database connection:", closeError);
    }

    // Exit with error code
    process.exit(1);
  }
}

// Run the main function
main();
