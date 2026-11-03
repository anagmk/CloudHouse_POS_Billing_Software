import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import Purchase from "../models/Purchase.model.js";
import Product from "../models/product.model.js";
import Supplier from "../models/Supplier.model.js";
import Payment from "../models/Payment.model.js";
import {
  makeLedgerRows,
  writeLedgerEntries,
  writePayments,
  writeStockMovement,
} from "../utils/financialRecords.js";

const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;
const paymentAccount = {
  cash: "Cash",
  upi: "UPI clearing",
  card: "Card clearing",
  bank: "Bank",
  other: "Other payment clearing",
};
const normalizePayments = (raw = []) =>
  raw.map((payment) => ({
    method:
      typeof payment?.method === "string" ? payment.method.toLowerCase() : "",
    amount: Number(payment?.amount),
    reference:
      typeof payment?.reference === "string" ? payment.reference.trim() : "",
  }));
const validPayments = (payments) =>
  payments.every(
    (payment) =>
      ["cash", "upi", "card", "bank", "other"].includes(payment.method) &&
      Number.isFinite(payment.amount) &&
      payment.amount > 0,
  );

const receivePurchaseStock = async (session, purchase, userId) => {
  const groups = new Map();
  for (const line of purchase.products) {
    const id = line.productId.toString();
    const current = groups.get(id) || { quantity: 0, costTotal: 0 };
    current.quantity += line.quantity;
    current.costTotal += line.unitCost * line.quantity;
    groups.set(id, current);
  }

  for (const [productId, group] of groups) {
    const product = await Product.findById(productId).session(session);
    if (!product || !product.isActive)
      throw new Error("A purchase product is missing or inactive");
    const previousStock = product.stockQuantity;
    const nextStock = previousStock + group.quantity;
    const previousValue = previousStock * (product.costPrice || 0);
    product.stockQuantity = nextStock;
    product.costPrice = roundMoney(
      (previousValue + group.costTotal) / nextStock,
    );
    await product.save({ session });
    await writeStockMovement(session, {
      movementKey: `purchase:${purchase._id}:product:${productId}:receive`,
      productId,
      movementType: "purchase",
      reason: `Stock received on ${purchase.purchaseNumber}`,
      quantityChange: group.quantity,
      balanceAfter: nextStock,
      unitCost: roundMoney(group.costTotal / group.quantity),
      sourceType: "purchase",
      sourceId: purchase._id,
      createdBy: userId,
    });
  }

  const inventoryValue = roundMoney(purchase.subtotal - purchase.discount);
  await writeLedgerEntries(
    session,
    makeLedgerRows({
      sourceType: "purchase",
      sourceId: purchase._id,
      reference: purchase.purchaseNumber,
      transactionType: "purchase",
      createdBy: userId,
      partyType: "supplier",
      partyId: purchase.supplierId,
      description: `Inventory received from supplier ${purchase.purchaseNumber}`,
      debits: [
        { account: "Inventory", amount: inventoryValue },
        { account: "GST input credit", amount: purchase.totalGst },
      ],
      credits: [{ account: "Accounts payable", amount: purchase.totalAmount }],
    }),
  );
};

export const listPurchases = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.supplierId && mongoose.isValidObjectId(req.query.supplierId))
      filter.supplierId = req.query.supplierId;
    if (["ordered", "received", "cancelled"].includes(req.query.status))
      filter.status = req.query.status;
    if (["unpaid", "partial", "paid"].includes(req.query.paymentStatus))
      filter.paymentStatus = req.query.paymentStatus;
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }
    const term =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (term)
      filter.purchaseNumber = {
        $regex: term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    const [purchases, total] = await Promise.all([
      Purchase.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("supplierId", "name companyName")
        .lean(),
      Purchase.countDocuments(filter),
    ]);
    return res
      .status(200)
      .json({
        success: true,
        purchases,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not load purchases", error: error.message });
  }
};

export const createPurchase = async (req, res) => {
  let session;
  try {
    const body = req.body || {};
    const { supplierId, products } = body;
    if (!mongoose.isValidObjectId(supplierId))
      return res.status(400).json({ message: "Valid supplierId is required" });
    if (!Array.isArray(products) || !products.length)
      return res
        .status(400)
        .json({ message: "At least one purchase product is required" });
    const idempotencyKey =
      req.get("Idempotency-Key") || body.idempotencyKey || randomUUID();
    const requestHash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const prior = await Purchase.findOne({ idempotencyKey });
    if (prior) {
      if (prior.requestHash && prior.requestHash !== requestHash)
        return res
          .status(409)
          .json({
            message: "Idempotency key already used for another purchase",
          });
      return res
        .status(200)
        .json({ message: "Purchase already recorded", purchase: prior });
    }

    const quantities = new Map();
    for (const line of products) {
      if (
        !line ||
        !mongoose.isValidObjectId(line.productId) ||
        !Number.isInteger(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(Number(line.unitCost)) ||
        Number(line.unitCost) < 0 ||
        !Number.isFinite(Number(line.gstRate ?? 0)) ||
        Number(line.gstRate ?? 0) < 0
      )
        return res
          .status(400)
          .json({
            message:
              "Each purchase line needs a product, positive integer quantity, non-negative unit cost, and valid GST rate",
          });
      const id = line.productId.toString();
      quantities.set(id, (quantities.get(id) || 0) + line.quantity);
    }

    session = await mongoose.startSession();
    let purchase;
    await session.withTransaction(async () => {
      const supplier = await Supplier.findOne({
        _id: supplierId,
        isActive: true,
      }).session(session);
      if (!supplier) throw new Error("Supplier not found or inactive");
      const productIds = [...quantities.keys()];
      const productsFound = await Product.find({
        _id: { $in: productIds },
        isActive: true,
      }).session(session);
      if (productsFound.length !== productIds.length)
        throw new Error("One or more products do not exist or are inactive");

      const subtotal = roundMoney(
        products.reduce(
          (sum, line) => sum + Number(line.unitCost) * line.quantity,
          0,
        ),
      );
      const discount = Number(body.discount || 0);
      if (!Number.isFinite(discount) || discount < 0 || discount > subtotal)
        throw new Error("Discount must be between zero and purchase subtotal");
      const purchaseLines = [];
      let tax = 0;
      let allocatedDiscount = 0;
      products.forEach((line, index) => {
        const product = productsFound.find(
          (item) => item._id.toString() === line.productId.toString(),
        );
        const base = roundMoney(Number(line.unitCost) * line.quantity);
        const lineDiscount =
          index === products.length - 1
            ? roundMoney(discount - allocatedDiscount)
            : subtotal > 0
              ? roundMoney((discount * base) / subtotal)
              : 0;
        allocatedDiscount = roundMoney(allocatedDiscount + lineDiscount);
        const lineGst = roundMoney(
          (base - lineDiscount) * (Number(line.gstRate || 0) / 100),
        );
        tax = roundMoney(tax + lineGst);
        purchaseLines.push({
          productId: product._id,
          name: product.name,
          sku: product.sku,
          quantity: line.quantity,
          receivedQuantity: 0,
          unitCost: Number(line.unitCost),
          gstRate: Number(line.gstRate || 0),
          lineDiscount,
          lineTotal: roundMoney(base - lineDiscount + lineGst),
        });
      });
      const totalAmount = roundMoney(subtotal - discount + tax);
      const payments = normalizePayments(body.payments || []);
      if (!validPayments(payments))
        throw new Error(
          "Purchase payments must use a valid method and positive amount",
        );
      const paidAmount = roundMoney(
        payments.reduce((sum, payment) => sum + payment.amount, 0),
      );
      if (paidAmount > totalAmount + 0.01)
        throw new Error("Payments cannot exceed purchase total");
      const balanceDue = roundMoney(Math.max(0, totalAmount - paidAmount));
      const receiveNow = body.receiveStock !== false;

      purchase = new Purchase({
        purchaseNumber: `PO-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
        idempotencyKey,
        requestHash,
        supplierId: supplier._id,
        products: purchaseLines,
        subtotal,
        totalGst: tax,
        discount,
        totalAmount,
        paidAmount,
        balanceDue,
        paymentStatus:
          balanceDue === 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
        status: receiveNow ? "received" : "ordered",
        payments,
        notes: typeof body.notes === "string" ? body.notes.trim() : "",
        createdBy: req.user._id,
        receivedAt: receiveNow ? new Date() : undefined,
      });
      await purchase.save({ session });

      if (receiveNow)
        await receivePurchaseStock(session, purchase, req.user._id);
      await writePayments(session, {
        payments,
        direction: "out",
        purpose: "purchase",
        relatedType: "purchase",
        relatedId: purchase._id,
        partyType: "supplier",
        partyId: supplier._id,
        createdBy: req.user._id,
      });
      if (payments.length) {
        const rows = payments.map((payment) => ({
          account: receiveNow ? "Accounts payable" : "Supplier advances",
          amount: payment.amount,
        }));
        await writeLedgerEntries(
          session,
          makeLedgerRows({
            sourceType: "purchase",
            sourceId: purchase._id,
            reference: purchase.purchaseNumber,
            transactionType: "payment",
            createdBy: req.user._id,
            partyType: "supplier",
            partyId: supplier._id,
            description: `Supplier payment for ${purchase.purchaseNumber}`,
            debits: rows,
            credits: payments.map((payment) => ({
              account: paymentAccount[payment.method],
              amount: payment.amount,
              paymentMethod: payment.method,
            })),
          }),
        );
      }
    });
    return res
      .status(201)
      .json({
        message:
          purchase.status === "received"
            ? "Purchase recorded and stock received"
            : "Purchase order created",
        purchase,
      });
  } catch (error) {
    if (error.code === 11000 && req.get("Idempotency-Key")) {
      const prior = await Purchase.findOne({
        idempotencyKey: req.get("Idempotency-Key"),
      });
      if (prior)
        return res
          .status(200)
          .json({ message: "Purchase already recorded", purchase: prior });
    }
    const clientError =
      /Valid|At least|Each purchase|Discount|Payments|Supplier not|products do not|exceed/.test(
        error.message,
      );
    return res
      .status(clientError ? 400 : 500)
      .json({ message: error.message || "Could not create purchase" });
  } finally {
    if (session) await session.endSession();
  }
};

export const receivePurchase = async (req, res) => {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid purchase ID" });
    session = await mongoose.startSession();
    let purchase;
    await session.withTransaction(async () => {
      purchase = await Purchase.findById(req.params.id).session(session);
      if (!purchase) throw new Error("Purchase not found");
      if (purchase.status === "received") return;
      if (purchase.status === "cancelled")
        throw new Error("Cancelled purchases cannot be received");
      await receivePurchaseStock(session, purchase, req.user._id);
      if (purchase.paidAmount > 0) {
        await writeLedgerEntries(
          session,
          makeLedgerRows({
            sourceType: "purchase",
            sourceId: purchase._id,
            reference: purchase.purchaseNumber,
            transactionType: "payment",
            createdBy: req.user._id,
            partyType: "supplier",
            partyId: purchase.supplierId,
            description: `Apply supplier advance to ${purchase.purchaseNumber}`,
            debits: [
              { account: "Accounts payable", amount: purchase.paidAmount },
            ],
            credits: [
              { account: "Supplier advances", amount: purchase.paidAmount },
            ],
          }),
        );
      }
      purchase.status = "received";
      purchase.receivedAt = new Date();
      purchase.products.forEach((line) => {
        line.receivedQuantity = line.quantity;
      });
      purchase = await purchase.save({ session });
    });
    return res
      .status(200)
      .json({ message: "Purchase stock received", purchase });
  } catch (error) {
    return res
      .status(/not found|Cancelled/.test(error.message) ? 400 : 500)
      .json({ message: error.message || "Could not receive purchase" });
  } finally {
    if (session) await session.endSession();
  }
};

export const addPurchasePayment = async (req, res) => {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid purchase ID" });
    const { method, amount, reference } = req.body || {};
    const normalizedMethod =
      typeof method === "string" ? method.toLowerCase() : "";
    const paymentAmount = Number(amount);
    if (
      !["cash", "upi", "card", "bank", "other"].includes(normalizedMethod) ||
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    )
      return res
        .status(400)
        .json({
          message: "Valid payment method and positive amount are required",
        });
    const idempotencyKey = req.get("Idempotency-Key") || randomUUID();
    const prior = await Payment.findOne({ idempotencyKey });
    if (prior)
      return res
        .status(200)
        .json({ message: "Payment already processed", payment: prior });
    session = await mongoose.startSession();
    let purchase;
    let payment;
    await session.withTransaction(async () => {
      purchase = await Purchase.findById(req.params.id).session(session);
      if (!purchase || purchase.status === "cancelled")
        throw new Error("Purchase not found or cancelled");
      if (paymentAmount > purchase.balanceDue + 0.01)
        throw new Error("Payment exceeds outstanding supplier balance");
      payment = new Payment({
        paymentNumber: `PAY-${randomUUID().slice(0, 12).toUpperCase()}`,
        idempotencyKey,
        direction: "out",
        purpose: "purchase",
        relatedType: "purchase",
        relatedId: purchase._id,
        partyType: "supplier",
        partyId: purchase.supplierId,
        amount: paymentAmount,
        method: normalizedMethod,
        reference,
        createdBy: req.user._id,
      });
      await payment.save({ session });
      purchase.payments.push({
        method: normalizedMethod,
        amount: paymentAmount,
        reference,
      });
      purchase.paidAmount = roundMoney(purchase.paidAmount + paymentAmount);
      purchase.balanceDue = roundMoney(
        Math.max(0, purchase.totalAmount - purchase.paidAmount),
      );
      purchase.paymentStatus = purchase.balanceDue === 0 ? "paid" : "partial";
      purchase = await purchase.save({ session });
      const clearingAccount =
        purchase.status === "received"
          ? "Accounts payable"
          : "Supplier advances";
      await writeLedgerEntries(
        session,
        makeLedgerRows({
          sourceType: "payment",
          sourceId: payment._id,
          reference: payment.paymentNumber,
          transactionType: "payment",
          createdBy: req.user._id,
          partyType: "supplier",
          partyId: purchase.supplierId,
          description: `Payment for ${purchase.purchaseNumber}`,
          debits: [{ account: clearingAccount, amount: paymentAmount }],
          credits: [
            {
              account: paymentAccount[normalizedMethod],
              amount: paymentAmount,
              paymentMethod: normalizedMethod,
            },
          ],
        }),
      );
    });
    return res
      .status(201)
      .json({ message: "Supplier payment recorded", purchase, payment });
  } catch (error) {
    return res
      .status(
        /Invalid|Valid|positive|not found|exceeds/.test(error.message)
          ? 400
          : 500,
      )
      .json({ message: error.message || "Could not record supplier payment" });
  } finally {
    if (session) await session.endSession();
  }
};
