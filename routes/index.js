import express from "express";
import * as indexController from "../controllers/indexController.js";

const router = express.Router();

router.get("/", indexController.getLost);

export default router;
