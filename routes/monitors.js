import express from "express";
import * as monitorController from "../controllers/monitorController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public routes (no authentication required)
router.get("/public/:id", monitorController.getPublicMonitorStatus);

// All routes below are protected - require authentication
router.use(protect);

// Dashboard stats (must come before /:id routes)
router.get("/dashboard/stats", monitorController.getDashboardStats);

// CRUD routes
router.post("/", monitorController.createMonitor);
router.get("/", monitorController.getMonitors);
router.get("/:id", monitorController.getMonitor);
router.put("/:id", monitorController.updateMonitor);
router.delete("/:id", monitorController.deleteMonitor);

// Additional routes
router.get("/:id/stats", monitorController.getMonitorStats);
router.post("/:id/pause", monitorController.pauseMonitor);
router.post("/:id/resume", monitorController.resumeMonitor);

export default router;
