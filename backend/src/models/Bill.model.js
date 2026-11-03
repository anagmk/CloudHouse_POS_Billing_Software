import mongoose from "mongoose";

const billPaymentSchema = new mongoose.Schema(
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

const billSchema = new mongoose.Schema(
  {
    billNumber: { type: String, unique: true, sparse: true, index: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    requestHash: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        gstRate: {
          type: Number,
          required: true,
        },
        lineDiscount: { type: Number, default: 0, min: 0 },
        restockable: { type: Boolean, default: true },
        total: {
          type: Number,
          required: true,
        },
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    totalGst: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "upi", "bank", "other"],
    },
    customerName: {
      type: String,
      required: false,
    },
    customerContact: {
      type: String,
      required: false,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    payments: { type: [billPaymentSchema], default: [] },
    paidAmount: { type: Number, default: 0, min: 0 },
    amountTendered: { type: Number, default: 0, min: 0 },
    changeDue: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "paid",
      index: true,
    },
    isCancelled: { type: Boolean, default: false, index: true },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    isReturn: {
      type: Boolean,
      default: false,
    },
    originalBillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      required: function () {
        return this.isReturn;
      },
    },
    returnVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

billSchema.index({ createdBy: 1, createdAt: -1 });
billSchema.index({ originalBillId: 1, isReturn: 1 });

const Bill = mongoose.model("Bill", billSchema);

export default Bill;
