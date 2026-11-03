import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    key: { type: String, default: "business", unique: true },
    storeName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "StockPilot",
    },
    address: { type: String, trim: true, maxlength: 500, default: "" },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
      default: "",
    },
    receiptFooter: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "Thank you for shopping with us.",
    },
    defaultReorderLevel: { type: Number, min: 0, default: 5 },
  },
  { timestamps: true },
);

export default mongoose.model("BusinessSettings", schema);
