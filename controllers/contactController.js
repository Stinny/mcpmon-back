import Contact from "../models/Contact.js";

// @desc    Submit contact message
// @route   POST /api/contact
// @access  Public
export const submitContact = async (req, res) => {
  try {
    const { email, message } = req.body;

    // Validate input
    if (!email || !message) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and message",
      });
    }

    // Create contact message
    const contact = await Contact.create({
      email,
      message,
    });

    res.status(201).json({
      success: true,
      data: contact,
      message: "Thank you for your message! We'll get back to you soon.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all contact messages (admin only, for future use)
// @route   GET /api/contact
// @access  Private/Admin
export const getAllContacts = async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
