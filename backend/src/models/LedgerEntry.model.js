import mongoose from "mongoose";

const ledgerEntrySchema = new mongoose.Schema(
  {
    entryKey: { type: String, required: true, unique: true },
    reference: { type: String, required: true, index: true },
    date: { type: Date, required: true, default: Date.now, index: true },
    transactionType: {
      type: String,
      enum: ["sale", "purchase", "refund", "payment", "expense", "adjustment"],
      required: true,
      index: true,
    },
    account: { type: String, required: true, index: true },
    partyType: { type: String, enum: ["customer", "supplier", "other"] },
    partyId: { type: mongoose.Schema.Types.ObjectId },
    description: { type: String, required: true, trim: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "other"],
    },
    sourceType: {
      type: String,
      enum: ["bill", "purchase", "expense", "payment", "stock_adjustment"],
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: "LedgerEntry" },
  },
  { timestamps: true },
);

ledgerEntrySchema.index({ date: -1, _id: -1 });
ledgerEntrySchema.index({ sourceType: 1, sourceId: 1 });

export default mongoose.model("LedgerEntry", ledgerEntrySchema);
