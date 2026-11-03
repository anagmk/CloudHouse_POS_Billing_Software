import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    movementKey: { type: String, required: true, unique: true },
    requestHash: { type: String },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    movementType: {
      type: String,
      enum: [
        "sale",
        "purchase",
        "return",
        "adjustment",
        "damage",
        "damaged_return",
        "cancellation",
      ],
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    quantityChange: { type: Number, required: true },
    damagedQuantity: { type: Number, default: 0, min: 0 },
    balanceAfter: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, min: 0 },
    sourceType: {
      type: String,
      enum: ["bill", "purchase", "return", "adjustment"],
      required: true,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

stockMovementSchema.index({ createdAt: -1, _id: -1 });
stockMovementSchema.index({ sourceType: 1, sourceId: 1 });

export default mongoose.model("StockMovement", stockMovementSchema);
