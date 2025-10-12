import express from "express";
import * as monitorController from "../controllers/monitorController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes are protected - require authentication
router.use(protect);

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
