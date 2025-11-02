import express from "express";
import * as contactController from "../controllers/contactController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public route
router.post("/", contactController.submitContact);

// Protected route (admin only - for future use)
router.get("/", protect, contactController.getAllContacts);

export default router;
