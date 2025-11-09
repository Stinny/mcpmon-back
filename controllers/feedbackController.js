import Feedback from "../models/Feedback.js";
import { sendFeedbackAlert } from "../services/slackService.js";

// @desc    Submit feedback
// @route   POST /api/feedback
// @access  Private
export const submitFeedback = async (req, res) => {
  try {
    const { feedback, allowResponse } = req.body;

    // Validate input
    if (!feedback) {
      return res.status(400).json({
        success: false,
        message: "Please provide feedback",
      });
    }

    // Create feedback
    const newFeedback = await Feedback.create({
      user: req.user.id,
      feedback,
      allowResponse: allowResponse || false,
    });

    // Send Slack notification (fire and forget)
    sendFeedbackAlert(req.user.id, feedback, allowResponse || false).catch((err) => {
      console.error("[Feedback Controller] Slack notification failed:", err);
    });

    res.status(201).json({
      success: true,
      data: newFeedback,
      message: "Thank you for your feedback!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all feedback (admin only, for future use)
// @route   GET /api/feedback
// @access  Private/Admin
export const getAllFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
