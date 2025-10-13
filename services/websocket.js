/**
 * WebSocket Service
 * Handles real-time communication with frontend clients for monitor updates
 */

import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

let wss = null;

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 */
export function initializeWebSocket(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  console.log("\n========================================");
  console.log("WebSocket Server Initialized");
  console.log("Path: /ws");
  console.log("========================================\n");

  wss.on("connection", (ws, req) => {
    console.log("New WebSocket connection attempt");

    // Mark connection as alive
    ws.isAlive = true;

    // Extract token from query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      console.log("WebSocket connection rejected: No token provided");
      ws.close(1008, "Authentication required");
      return;
    }

    // Verify JWT token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      ws.userId = decoded.id;
      console.log(`WebSocket authenticated for user: ${ws.userId} (Total clients: ${wss.clients.size})`);

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: "connected",
          message: "WebSocket connection established",
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.log("WebSocket connection rejected: Invalid token");
      ws.close(1008, "Invalid authentication token");
      return;
    }

    // Handle pong responses for heartbeat
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Handle client messages
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        console.log("Received WebSocket message:", data);

        // Handle ping messages
        if (data.type === "ping") {
          ws.send(
            JSON.stringify({
              type: "pong",
              timestamp: new Date().toISOString(),
            }),
          );
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });

    // Handle connection close
    ws.on("close", () => {
      console.log(`WebSocket disconnected for user: ${ws.userId} (Total clients: ${wss.clients.size})`);
    });

    // Handle errors
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      ws.terminate();
    });
  });

  // Set up heartbeat interval to detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        console.log(`Terminating dead WebSocket connection for user: ${ws.userId}`);
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Check every 30 seconds

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

/**
 * Broadcast monitor update to all connected clients for a specific user
 * @param {String} userId - User ID to send update to
 * @param {Object} monitorData - Monitor data to broadcast
 */
export function broadcastMonitorUpdate(userId, monitorData) {
  if (!wss) {
    console.warn("WebSocket server not initialized");
    return;
  }

  const message = JSON.stringify({
    type: "monitor_update",
    data: monitorData,
    timestamp: new Date().toISOString(),
  });

  let sentCount = 0;
  wss.clients.forEach((client) => {
    if (
      client.userId === userId.toString() &&
      client.readyState === 1 // WebSocket.OPEN
    ) {
      client.send(message);
      sentCount++;
    }
  });

  if (sentCount > 0) {
    console.log(
      `Broadcasted monitor update to ${sentCount} client(s) for user ${userId}`,
    );
  }
}

/**
 * Broadcast monitor updates to multiple users
 * @param {Array} updates - Array of {userId, monitorData} objects
 */
export function broadcastMultipleUpdates(updates) {
  if (!wss) {
    console.warn("WebSocket server not initialized");
    return;
  }

  updates.forEach(({ userId, monitorData }) => {
    broadcastMonitorUpdate(userId, monitorData);
  });
}

/**
 * Get connected client count
 * @returns {Number} Number of connected clients
 */
export function getConnectedClientsCount() {
  return wss ? wss.clients.size : 0;
}

/**
 * Close WebSocket server
 */
export function closeWebSocket() {
  if (wss) {
    console.log("\nClosing WebSocket server...");
    wss.close(() => {
      console.log("WebSocket server closed");
    });
    wss = null;
  }
}
