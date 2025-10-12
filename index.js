import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import connectDB from "./config/db.js";
import indexRoutes from "./routes/index.js";
import authRoutes from "./routes/auth.js";
import monitorRoutes from "./routes/monitors.js";
import { startScheduler } from "./services/scheduler.js";
import { initializeWebSocket, closeWebSocket } from "./services/websocket.js";

dotenv.config();

// Connect to database
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/monitors", monitorRoutes);
app.use("/", indexRoutes);

// Create HTTP server and integrate WebSocket
const server = createServer(app);
initializeWebSocket(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Start the monitor check scheduler (runs every 1 minute)
  startScheduler();
});

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
