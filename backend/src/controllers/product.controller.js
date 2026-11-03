import Product from "../models/product.model.js";
import crypto from "crypto";
import mongoose from "mongoose";
import StockMovement from "../models/StockMovement.model.js";

const generateSKU = () => {
  return `SKU-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
};
export const createProduct = async (req, res) => {
  try {
    const { name, price, category, stockQuantity, gstRate } = req.body || {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanCategory = typeof category === "string" ? category.trim() : "";
    if (
      !cleanName ||
      !cleanCategory ||
      price === undefined ||
      stockQuantity === undefined ||
      gstRate === undefined
    ) {
      return res
        .status(400)
        .json({
          message:
            "Name, price, category, stock quantity, and GST rate are required",
        });
    }
    if (
      ![price, stockQuantity, gstRate].every((value) =>
        Number.isFinite(Number(value)),
      ) ||
      Number(price) < 0 ||
      Number(stockQuantity) < 0 ||
      Number(gstRate) < 0
    ) {
      return res
        .status(400)
        .json({
          message:
            "Price, stock quantity, and GST rate must be valid non-negative numbers",
        });
    }

    const existingProduct = await Product.findOne({ name: cleanName });
    if (existingProduct) {
      return res
        .status(409)
        .json({ message: "Product with this name already exists" });
    }
    const product = new Product({
      createdBy: req.user._id,
      name: cleanName,
      price: Number(price),
      category: cleanCategory,
      stockQuantity: Number(stockQuantity),
      sku: generateSKU(),
      gstRate: Number(gstRate),
    });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await product.save({ session });
        if (product.stockQuantity > 0) {
          const movement = new StockMovement({
            movementKey: `product-init:${product._id}`,
            productId: product._id,
            movementType: "adjustment",
            reason: "Initial stock recorded when product was created",
            quantityChange: product.stockQuantity,
            balanceAfter: product.stockQuantity,
            unitCost: product.costPrice,
            sourceType: "adjustment",
            createdBy: req.user._id,
          });
          movement.sourceId = movement._id;
          await movement.save({ session });
        }
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({
      message: "Product created successfully",
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        category: product.category,
        stockQuantity: product.stockQuantity,
        sku: product.sku,
        gstRate: product.gstRate,
        isActive: product.isActive,
      },
    });
  } catch (error) {
    console.log("Error creating product:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const { search = "", page = 1, limit = 10 } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(limit) || 10));

    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const filter = safeSearch
      ? {
          $or: [
            { name: { $regex: safeSearch, $options: "i" } },
            { description: { $regex: safeSearch, $options: "i" } },
            { sku: { $regex: safeSearch, $options: "i" } },
          ],
        }
      : {};

    const [products, total] = await Promise.all([
      Product.find(filter)
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .sort({ createdAt: -1 }),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: pageNumber,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize),
      products,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "A product with this SKU already exists" });
    }
    console.error("Product search error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const { name, price, category, stockQuantity, gstRate, stockReason } =
      req.body || {};
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ message: "Name must not be empty" });
    }
    if (
      category !== undefined &&
      (typeof category !== "string" || !category.trim())
    ) {
      return res.status(400).json({ message: "Category must not be empty" });
    }
    for (const [field, value] of Object.entries({
      price,
      stockQuantity,
      gstRate,
    })) {
      if (
        value !== undefined &&
        (!Number.isFinite(Number(value)) || Number(value) < 0)
      ) {
        return res
          .status(400)
          .json({ message: `${field} must be a valid non-negative number` });
      }
    }
    if (name !== undefined) {
      const duplicate = await Product.exists({
        name: name.trim(),
        _id: { $ne: req.params.id },
      });
      if (duplicate) {
        return res
          .status(409)
          .json({ message: "Product with this name already exists" });
      }
    }
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (name !== undefined) product.name = name.trim();
    if (price !== undefined) product.price = Number(price);
    if (category !== undefined) product.category = category.trim();
    const previousStock = product.stockQuantity;
    if (stockQuantity !== undefined)
      product.stockQuantity = Number(stockQuantity);
    if (gstRate !== undefined) product.gstRate = Number(gstRate);

    await product.save();
    if (product.stockQuantity !== previousStock) {
      const movement = new StockMovement({
        movementKey: `product-edit:${product._id}:${Date.now()}`,
        productId: product._id,
        movementType:
          product.stockQuantity < previousStock ? "damage" : "adjustment",
        reason:
          typeof stockReason === "string" && stockReason.trim()
            ? stockReason.trim()
            : "Stock quantity changed from product editor",
        quantityChange: product.stockQuantity - previousStock,
        balanceAfter: product.stockQuantity,
        unitCost: product.costPrice,
        sourceType: "adjustment",
        createdBy: req.user._id,
      });
      movement.sourceId = movement._id;
      await movement.save();
    }
    res.status(200).json(product);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
