import mongoose from "mongoose";

const purchaseLineSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true },
    sku: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    receivedQuantity: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0, min: 0 },
    lineDiscount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const purchasePaymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["cash", "upi", "card", "bank", "other"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    reference: { type: String, trim: true },
  },
  { _id: false },
);

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true, index: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    requestHash: { type: String },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    products: {
      type: [purchaseLineSchema],
      required: true,
      validate: (items) => items.length > 0,
    },
    subtotal: { type: Number, required: true, min: 0 },
    totalGst: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
      index: true,
    },
    status: {
      type: String,
      enum: ["ordered", "received", "cancelled"],
      default: "ordered",
      index: true,
    },
    payments: { type: [purchasePaymentSchema], default: [] },
    notes: { type: String, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receivedAt: { type: Date },
  },
  { timestamps: true },
);

purchaseSchema.index({ createdAt: -1, _id: -1 });

export default mongoose.model("Purchase", purchaseSchema);
