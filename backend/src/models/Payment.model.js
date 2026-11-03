import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    direction: { type: String, enum: ["in", "out"], required: true },
    purpose: {
      type: String,
      enum: ["sale", "purchase", "refund", "expense", "collection"],
      required: true,
    },
    relatedType: {
      type: String,
      enum: ["bill", "purchase", "expense"],
      required: true,
    },
    relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
    partyType: { type: String, enum: ["customer", "supplier", "other"] },
    partyId: { type: mongoose.Schema.Types.ObjectId },
    amount: { type: Number, required: true, min: 0.01 },
    method: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "other"],
      required: true,
    },
    reference: { type: String, trim: true },
    notes: { type: String, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

paymentSchema.index({ relatedType: 1, relatedId: 1, createdAt: -1 });

export default mongoose.model("Payment", paymentSchema);
