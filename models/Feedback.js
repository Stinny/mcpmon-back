import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    feedback: {
      type: String,
      required: [true, "Feedback is required"],
      maxlength: [300, "Feedback cannot exceed 300 characters"],
      trim: true,
    },
    allowResponse: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);

export default Feedback;
