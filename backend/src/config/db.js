import mongoose from "mongoose";

export async function connectDB() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const uri = url.startsWith("mongodb")
    ? url
    : `mongodb+srv://${encodeURIComponent(process.env.MONGODB_USERNAME || "")}:${encodeURIComponent(
        process.env.MONGODB_PASSWORD || "",
      )}@${url}/cloudhouse?retryWrites=true&w=majority`;

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
}
