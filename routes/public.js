import express from "express";
import rateLimit from "express-rate-limit";
import * as publicController from "../controllers/publicController.js";

const router = express.Router();

// Rate limiter for scan endpoint - 3 scans per hour per IP
const scanLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour
  message: {
    success: false,
    message:
      "Too many scan requests from this IP. Please try again in an hour.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for local development (optional)
  skip: (req) => {
    return (
      process.env.NODE_ENV === "development" &&
      (req.ip === "127.0.0.1" || req.ip === "::1")
    );
  },
});

// Daily rate limiter as backup - 10 scans per day per IP
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // 10 requests per day
  message: {
    success: false,
    message:
      "Daily scan limit reached for this IP. Please try again tomorrow.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return (
      process.env.NODE_ENV === "development" &&
      (req.ip === "127.0.0.1" || req.ip === "::1")
    );
  },
});

/**
 * POST /api/public/scan-server
 * Perform a one-time scan of an MCP server
 * No authentication required - public endpoint
 */
router.post(
  "/scan-server",
  scanLimiter,
  dailyLimiter,
  publicController.scanServer
);

export default router;
