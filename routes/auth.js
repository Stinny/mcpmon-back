import express from "express";
import passport from "passport";
import * as authController from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/verify-email/:token", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);

// Password reset routes (public)
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

// GitHub OAuth routes
router.get(
  "/github",
  passport.authenticate("github", {
    scope: ["user:email"],
    session: false
  })
);
router.get("/github/callback", authController.githubCallback);

// Protected routes
router.get("/me", protect, authController.getMe);
router.put("/profile", protect, authController.updateProfile);
router.put("/alerts", protect, authController.updateAlertPreferences);
router.put("/change-password", protect, authController.changePassword);
router.delete("/account", protect, authController.deleteAccount);

// Phone verification routes
router.post(
  "/send-phone-verification",
  protect,
  authController.sendPhoneVerification,
);
router.post("/verify-phone", protect, authController.verifyPhoneCode);
router.post(
  "/resend-phone-verification",
  protect,
  authController.resendPhoneVerification,
);

export default router;
