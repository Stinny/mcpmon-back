import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import passport from "passport";
import connectDB from "./config/db.js";
import { configurePassport } from "./config/passport.js";
import indexRoutes from "./routes/index.js";
import authRoutes from "./routes/auth.js";
import monitorRoutes from "./routes/monitors.js";
import feedbackRoutes from "./routes/feedback.js";
import contactRoutes from "./routes/contact.js";
import subscribeRoutes from "./routes/subscribe.js";
import { startScheduler, runImmediateCheck } from "./services/scheduler.js";
import { initializeWebSocket, closeWebSocket } from "./services/websocket.js";

dotenv.config();

// Verify encryption key is loaded
if (!process.env.ENCRYPTION_KEY) {
  console.error("❌ ERROR: ENCRYPTION_KEY environment variable is not set!");
  console.error("Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize Passport
configurePassport();
app.use(passport.initialize());

app.use("/api/auth", authRoutes);
app.use("/api/monitors", monitorRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/subscribe", subscribeRoutes);
app.use("/", indexRoutes);

// Create HTTP server and integrate WebSocket
const server = createServer(app);
initializeWebSocket(server);

// Connect to database and start server
async function startServer() {
  try {
    console.log("🔄 Connecting to database...");
    // Wait for database connection
    await connectDB();
    console.log("✅ Database connected successfully");

    server.listen(PORT, async () => {
      console.log(`\n🚀 Server is running on port ${PORT}`);
      console.log(`📅 Time: ${new Date().toISOString()}\n`);

      // Start the monitor check scheduler (runs every 1 minute)
      console.log("🕐 Starting scheduler...");
      const job = startScheduler();
      console.log("✅ Scheduler started:", job ? "SUCCESS" : "FAILED");

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
