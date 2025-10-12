import mongoose from "mongoose";

const connectDB = async () => {
  try {
    console.log("Attempting to connect to MongoDB...");
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✓ MongoDB Connected Successfully: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`✗ MongoDB Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error(`MongoDB connection error: ${err}`);
});

export default connectDB;
