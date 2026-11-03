import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: false,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    costPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    category: {
      type: String,
      required: true,
    },
    stockQuantity: {
      type: Number,
      required: true,
    },
    reorderLevel: {
      type: Number,
      default: 5,
      min: 0,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
    },
    gstRate: {
      type: Number,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

productSchema.index({ isActive: 1, stockQuantity: 1 });
productSchema.index({ supplierId: 1, createdAt: -1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
