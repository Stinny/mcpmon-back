// Load environment variables FIRST before any other imports
import './config/env.js';

import express from "express";
import cors from "cors";
import { createServer } from "http";
import passport from "passport";
import connectDB from "./config/db.js";
import { configurePassport } from "./config/passport.js";
import { verifyEnv } from "./config/env.js";
import indexRoutes from "./routes/index.js";
import authRoutes from "./routes/auth.js";
import monitorRoutes from "./routes/monitors.js";
import feedbackRoutes from "./routes/feedback.js";
import contactRoutes from "./routes/contact.js";
import subscribeRoutes from "./routes/subscribe.js";
import securityRoutes from "./routes/security.js";
import publicRoutes from "./routes/public.js";
import { startScheduler, runImmediateCheck } from "./services/scheduler.js";
import { startSecurityScheduler } from "./services/securityScheduler.js";
import { initializeWebSocket, closeWebSocket } from "./services/websocket.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Passport
configurePassport();
app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/monitors", monitorRoutes);
app.use("/api/security-scans", securityRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/subscribe", subscribeRoutes);
app.use("/api/public", publicRoutes);
app.use("/", indexRoutes);

// Create HTTP server and integrate WebSocket
const server = createServer(app);
initializeWebSocket(server);

// Connect to database and start server
async function startServer() {
  try {
    // Verify environment variables are loaded
    console.log("\n🔍 Verifying environment configuration...");
    verifyEnv();

    console.log("\n🔄 Connecting to database...");
    // Wait for database connection
    await connectDB();
    console.log("✅ Database connected successfully");

    server.listen(PORT, async () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📅 Time: ${new Date().toISOString()}\n`);

      // Start the monitor check scheduler (runs every 1 minute)
      console.log("🕐 Starting monitor scheduler...");
      const job = startScheduler();
      console.log("✅ Monitor scheduler started:", job ? "SUCCESS" : "FAILED");

      // Start the security scan scheduler (runs every 30 minutes)
      console.log("🔒 Starting security scan scheduler...");
      startSecurityScheduler();
      console.log("✅ Security scan scheduler started");

      // Run an immediate check to verify everything works
      console.log("\n🧪 Running immediate test check...");
      try {
        await runImmediateCheck();
        console.log("✅ Test check completed successfully\n");
      } catch (error) {
        console.error("❌ Test check failed:", error.message);
      }
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

console.log("🔵 Starting application...");
startServer();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nReceived SIGINT signal. Shutting down gracefully...");
  closeWebSocket();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nReceived SIGTERM signal. Shutting down gracefully...");
  closeWebSocket();
  process.exit(0);
});
