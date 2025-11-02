import Subscriber from "../models/Subscriber.js";

// @desc    Subscribe email to newsletter
// @route   POST /api/subscribe
// @access  Public
export const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Check if email already exists
    const existingSubscriber = await Subscriber.findOne({ email });

    if (existingSubscriber) {
      // If already subscribed and active
      if (existingSubscriber.isActive) {
        return res.status(200).json({
          success: true,
          message: "You're already subscribed!",
        });
      }

      // If previously unsubscribed, reactivate
      existingSubscriber.isActive = true;
      existingSubscriber.subscribedAt = Date.now();
      await existingSubscriber.save();

      return res.status(200).json({
        success: true,
        message: "Welcome back! You've been resubscribed.",
      });
    }

    // Create new subscriber
    await Subscriber.create({ email });

    res.status(201).json({
      success: true,
      message: "Thanks for subscribing!",
    });
  } catch (error) {
    console.error("Subscription error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to subscribe. Please try again.",
    });
  }
};

// @desc    Unsubscribe email from newsletter
// @route   POST /api/unsubscribe
// @access  Public
export const unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const subscriber = await Subscriber.findOne({ email });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: "Email not found in our subscription list",
      });
    }

    subscriber.isActive = false;
    await subscriber.save();

    res.status(200).json({
      success: true,
      message: "You've been unsubscribed successfully",
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unsubscribe. Please try again.",
    });
  }
};
