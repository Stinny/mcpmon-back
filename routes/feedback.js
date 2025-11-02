import express from "express";
import * as feedbackController from "../controllers/feedbackController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Protected routes
router.post("/", protect, feedbackController.submitFeedback);
router.get("/", protect, feedbackController.getAllFeedback);

export default router;
