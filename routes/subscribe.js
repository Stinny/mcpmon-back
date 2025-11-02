import express from "express";
import * as subscriberController from "../controllers/subscriberController.js";

const router = express.Router();

// Public routes (no authentication required)
router.post("/", subscriberController.subscribe);
router.post("/unsubscribe", subscriberController.unsubscribe);

export default router;
