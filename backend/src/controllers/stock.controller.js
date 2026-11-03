import mongoose from "mongoose";
import Product from "../models/product.model.js";
import StockMovement from "../models/StockMovement.model.js";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";

export const listStockMovements = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const filter = {};
    if (req.query.productId && mongoose.isValidObjectId(req.query.productId))
      filter.productId = req.query.productId;
    if (req.query.type) filter.movementType = req.query.type;
    const [movements, total] = await Promise.all([
      StockMovement.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("productId", "name sku")
        .populate("createdBy", "username")
        .lean(),
      StockMovement.countDocuments(filter),
    ]);
    return res.json({
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Could not load stock movements",
        error: error.message,
      });
  }
};

export const adjustStock = async (req, res) => {
  let session;
  try {
    const { productId, quantityChange, reason } = req.body || {};
    const change = Number(quantityChange);
    if (
      !mongoose.isValidObjectId(productId) ||
      !Number.isInteger(change) ||
      change === 0 ||
      typeof reason !== "string" ||
      !reason.trim()
    )
      return res
        .status(400)
        .json({
          message:
            "Product, non-zero whole-number quantity change, and reason are required",
        });
    const idempotencyKey = req.get("Idempotency-Key") || randomUUID();
    const movementKey = `adjustment:${idempotencyKey}`;
    const requestHash = createHash("sha256")
      .update(JSON.stringify(req.body || {}))
      .digest("hex");
    const prior = await StockMovement.findOne({ movementKey });
    if (prior)
      return res
        .status(
          prior.requestHash && prior.requestHash !== requestHash ? 409 : 200,
        )
        .json(
          prior.requestHash && prior.requestHash !== requestHash
            ? { message: "Idempotency key already used for another adjustment" }
            : { message: "Stock adjustment already recorded", movement: prior },
        );
    session = await mongoose.startSession();
    let product;
    let movement;
    await session.withTransaction(async () => {
      product = await Product.findById(productId).session(session);
      if (!product || !product.isActive)
        throw new Error("Product not found or inactive");
      const next = product.stockQuantity + change;
      if (next < 0)
        throw new Error("Adjustment cannot reduce stock below zero");
      product.stockQuantity = next;
      await product.save({ session });
      movement = new StockMovement({
        movementKey,
        requestHash,
        productId: product._id,
        movementType: change > 0 ? "adjustment" : "damage",
        reason: reason.trim(),
        quantityChange: change,
        balanceAfter: next,
        unitCost: product.costPrice,
        sourceType: "adjustment",
        createdBy: req.user._id,
      });
      movement.sourceId = movement._id;
      await movement.save({ session });
    });
    return res.json({ message: "Stock adjusted", product, movement });
  } catch (error) {
    return res
      .status(/not found|below zero/.test(error.message) ? 400 : 500)
      .json({ message: error.message || "Could not adjust stock" });
  } finally {
    if (session) await session.endSession();
  }
};
