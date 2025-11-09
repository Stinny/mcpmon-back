import jwt from "jsonwebtoken";
import crypto from "crypto";
import passport from "passport";
import User from "../models/User.js";
import { sendVerificationEmail } from "../services/emailService.js";
import {
  sendVerificationCodeSMS,
  generateVerificationCode,
} from "../services/smsService.js";
import { sendUserSignupAlert } from "../services/slackService.js";

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      // Provide specific message if account was created via OAuth
      if (userExists.authProvider !== "local") {
        return res.status(400).json({
          success: false,
          message: `An account with this email already exists. Please sign in with ${userExists.authProvider === "github" ? "GitHub" : "your OAuth provider"}.`,
          code: "OAUTH_ACCOUNT_EXISTS",
        });
      }

      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    // Create user with verification token
    const user = await User.create({
      email,
      password,
      name,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    });

    if (user) {
      console.log(`[Auth Controller] User created successfully: ${user.email}`);

      // Send Slack notification (fire and forget)
      sendUserSignupAlert(user).catch((err) => {
        console.error("[Auth Controller] Slack notification failed:", err);
      });

      console.log(`[Auth Controller] Attempting to send verification email...`);

      // Send verification email
      try {
        await sendVerificationEmail(user, verificationToken);

        console.log(`[Auth Controller] Verification email sent successfully`);
        res.status(201).json({
          success: true,
          message:
            "Account created successfully! Please check your email to verify your account.",
          data: {
            email: user.email,
          },
        });
      } catch (emailError) {
        // If email fails, still create user but inform them
        console.error("[Auth Controller] Email sending failed:", emailError);
        res.status(201).json({
          success: true,
          message:
            "Account created but verification email could not be sent. Please contact support.",
          data: {
            email: user.email,
          },
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid user data",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Check for user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user signed up with OAuth (no password set)
    if (!user.password || user.authProvider !== "local") {
      return res.status(400).json({
        success: false,
        message: `This account was created using ${user.authProvider === "github" ? "GitHub" : "OAuth"}. Please sign in with ${user.authProvider === "github" ? "GitHub" : "your OAuth provider"} instead.`,
        code: "OAUTH_ACCOUNT",
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message:
          "Please verify your email before logging in. Check your inbox for the verification link.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // Get user without password
    const userWithoutPassword = await User.findById(user._id).select(
      "-password",
    );
    const userObj = userWithoutPassword.toObject();

    res.status(200).json({
      success: true,
      data: {
        ...userObj,
        id: userObj._id,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Fields that can be updated
    const { name, email, phone } = req.body;

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use",
        });
      }
      user.email = email;
    }

    // Update fields if provided
    if (name !== undefined) user.name = name;

    // Handle phone number changes
    if (phone !== undefined && phone !== user.phone) {
      user.phone = phone;

      // If phone is being updated (not just cleared)
      if (phone) {
        // Invalidate previous verification
        user.isPhoneVerified = false;
        user.phoneVerificationCode = null;
        user.phoneVerificationExpires = null;
        user.phoneVerificationSentAt = null;

        // Generate and send new verification code
        const verificationCode = generateVerificationCode();
        user.phoneVerificationCode = verificationCode;
        user.phoneVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
        user.phoneVerificationSentAt = Date.now();

        await user.save();

        // Send verification SMS (don't block on this)
        try {
          await sendVerificationCodeSMS(phone, verificationCode);
          console.log(
            `[Auth Controller] Verification code sent to ${phone} for user ${user.email}`,
          );
        } catch (smsError) {
          console.error(
            `[Auth Controller] Failed to send verification SMS:`,
            smsError,
          );
          // Continue - user can resend later
        }
      } else {
        // Phone is being cleared
        user.isPhoneVerified = false;
        user.phoneVerificationCode = null;
        user.phoneVerificationExpires = null;
        user.phoneVerificationSentAt = null;
      }
    } else {
      await user.save();
    }

    // Return user without password
    const updatedUser = await User.findById(user._id).select("-password");

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update alert preferences
// @route   PUT /api/auth/alerts
// @access  Private
export const updateAlertPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { emailAlertsEnabled, smsAlertsEnabled } = req.body;

    // Update alert preferences if provided
    if (emailAlertsEnabled !== undefined) {
      user.emailAlertsEnabled = emailAlertsEnabled;
    }
    if (smsAlertsEnabled !== undefined) {
      user.smsAlertsEnabled = smsAlertsEnabled;
    }

    await user.save();

    // Return user without password
    const updatedUser = await User.findById(user._id).select("-password");

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Verify user email
// @route   GET /api/auth/verify-email/:token
// @access  Public
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    console.log("Token:", token);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // Hash the token from URL to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with matching token and unexpired verification
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    // Verify the email
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now log in.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email",
      });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    // Update user with new token
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user, verificationToken);

      res.status(200).json({
        success: true,
        message: "Verification email sent! Please check your inbox.",
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      res.status(500).json({
        success: false,
        message: "Failed to send verification email. Please try again later.",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete user account
// @route   DELETE /api/auth/account
// @access  Private
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find user
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete all monitors associated with this user
    const Monitor = (await import("../models/Monitor.js")).default;
    const deletedMonitors = await Monitor.deleteMany({ userId });
    console.log(
      `[Delete Account] Deleted ${deletedMonitors.deletedCount} monitors for user ${user.email}`,
    );

    // Delete the user
    await User.findByIdAndDelete(userId);
    console.log(`[Delete Account] Deleted user account: ${user.email}`);

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("[Delete Account] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Send phone verification code
// @route   POST /api/auth/send-phone-verification
// @access  Private
export const sendPhoneVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has a phone number
    if (!user.phone) {
      return res.status(400).json({
        success: false,
        message: "Please add a phone number first",
      });
    }

    // Check if already verified
    if (user.isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone number is already verified",
      });
    }

    // Rate limiting: Check if user sent verification code in the last minute
    if (
      user.phoneVerificationSentAt &&
      Date.now() - user.phoneVerificationSentAt < 60 * 1000
    ) {
      const secondsRemaining = Math.ceil(
        (60 * 1000 - (Date.now() - user.phoneVerificationSentAt)) / 1000,
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${secondsRemaining} seconds before requesting another code`,
        secondsRemaining,
      });
    }

    // Generate and save verification code
    const verificationCode = generateVerificationCode();
    user.phoneVerificationCode = verificationCode;
    user.phoneVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.phoneVerificationSentAt = Date.now();
    await user.save();

    // Send verification SMS
    try {
      await sendVerificationCodeSMS(user.phone, verificationCode);
      console.log(
        `[Auth Controller] Verification code sent to ${user.phone} for user ${user.email}`,
      );

      res.status(200).json({
        success: true,
        message: "Verification code sent to your phone",
      });
    } catch (smsError) {
      console.error(
        `[Auth Controller] Failed to send verification SMS:`,
        smsError,
      );
      res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again later.",
      });
    }
  } catch (error) {
    console.error("[Send Phone Verification] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Verify phone code
// @route   POST /api/auth/verify-phone
// @access  Private
export const verifyPhoneCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has a phone number
    if (!user.phone) {
      return res.status(400).json({
        success: false,
        message: "No phone number to verify",
      });
    }

    // Check if already verified
    if (user.isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone number is already verified",
      });
    }

    // Check if verification code exists
    if (!user.phoneVerificationCode) {
      return res.status(400).json({
        success: false,
        message: "No verification code found. Please request a new code.",
      });
    }

    // Check if code has expired
    if (Date.now() > user.phoneVerificationExpires) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new code.",
      });
    }

    // Verify the code
    if (code.trim() !== user.phoneVerificationCode) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Mark phone as verified
    user.isPhoneVerified = true;
    user.phoneVerificationCode = null;
    user.phoneVerificationExpires = null;
    user.phoneVerificationSentAt = null;
    await user.save();

    console.log(
      `[Auth Controller] Phone verified successfully for user ${user.email}`,
    );

    // Return updated user without password
    const updatedUser = await User.findById(user._id).select("-password");

    res.status(200).json({
      success: true,
      message: "Phone number verified successfully!",
      data: updatedUser,
    });
  } catch (error) {
    console.error("[Verify Phone Code] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Resend phone verification code
// @route   POST /api/auth/resend-phone-verification
// @access  Private
export const resendPhoneVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has a phone number
    if (!user.phone) {
      return res.status(400).json({
        success: false,
        message: "Please add a phone number first",
      });
    }

    // Check if already verified
    if (user.isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: "Phone number is already verified",
      });
    }

    // Rate limiting: Check if user sent verification code in the last minute
    if (
      user.phoneVerificationSentAt &&
      Date.now() - user.phoneVerificationSentAt < 60 * 1000
    ) {
      const secondsRemaining = Math.ceil(
        (60 * 1000 - (Date.now() - user.phoneVerificationSentAt)) / 1000,
      );
      return res.status(429).json({
        success: false,
        message: `Please wait ${secondsRemaining} seconds before requesting another code`,
        secondsRemaining,
      });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();
    user.phoneVerificationCode = verificationCode;
    user.phoneVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.phoneVerificationSentAt = Date.now();
    await user.save();

    // Send verification SMS
    try {
      await sendVerificationCodeSMS(user.phone, verificationCode);
      console.log(
        `[Auth Controller] Verification code resent to ${user.phone} for user ${user.email}`,
      );

      res.status(200).json({
        success: true,
        message: "Verification code sent to your phone",
      });
    } catch (smsError) {
      console.error(
        `[Auth Controller] Failed to resend verification SMS:`,
        smsError,
      );
      res.status(500).json({
        success: false,
        message: "Failed to send verification code. Please try again later.",
      });
    }
  } catch (error) {
    console.error("[Resend Phone Verification] Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    GitHub OAuth callback
// @route   GET /api/auth/github/callback
// @access  Public
export const githubCallback = (req, res, next) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  // Use custom callback to handle errors manually
  passport.authenticate("github", { session: false }, async (err, user, info) => {
    try {
      // Handle authentication errors
      if (err) {
        console.error("[GitHub Callback] Authentication error:", err.message);
        return res.redirect(
          `${frontendUrl}/auth/callback?error=${encodeURIComponent(err.message)}`,
        );
      }

      // Handle case where no user was returned
      if (!user) {
        return res.redirect(
          `${frontendUrl}/auth/callback?error=Authentication failed`,
        );
      }

      // Generate JWT token
      const token = generateToken(user._id);

      // Get user without password
      const userWithoutPassword = await User.findById(user._id).select(
        "-password",
      );
      const userObj = userWithoutPassword.toObject();

      // Redirect to frontend with token and user data
      const userData = encodeURIComponent(
        JSON.stringify({
          ...userObj,
          id: userObj._id,
          token,
        }),
      );

      res.redirect(`${frontendUrl}/auth/callback?success=true&data=${userData}`);
    } catch (error) {
      console.error("[GitHub Callback] Error:", error);
      res.redirect(
        `${frontendUrl}/auth/callback?error=${encodeURIComponent(error.message)}`,
      );
    }
  })(req, res, next);
};
