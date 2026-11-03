import mongoose from "mongoose";
import { createHash, randomUUID } from "node:crypto";
import Expense from "../models/Expense.model.js";
import Payment from "../models/Payment.model.js";
import {
  makeLedgerRows,
  writeLedgerEntries,
} from "../utils/financialRecords.js";

const methods = ["cash", "upi", "card", "bank", "other"];

export const listExpenses = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from && !Number.isNaN(Date.parse(req.query.from)))
        filter.date.$gte = new Date(req.query.from);
      if (req.query.to && !Number.isNaN(Date.parse(req.query.to)))
        filter.date.$lte = new Date(`${req.query.to}T23:59:59.999`);
    }
    if (req.query.category) filter.category = req.query.category;
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { expenseNumber: { $regex: safe, $options: "i" } },
        { description: { $regex: safe, $options: "i" } },
        { category: { $regex: safe, $options: "i" } },
        { reference: { $regex: safe, $options: "i" } },
      ];
    }
    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "username")
        .lean(),
      Expense.countDocuments(filter),
    ]);
    return res.json({
      expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not load expenses", error: error.message });
  }
};

export const createExpense = async (req, res) => {
  let session;
  let idempotencyKey;
  try {
    const { category, description, amount, date, paymentMethod, reference } =
      req.body || {};
    const numericAmount = Number(amount);
    const method =
      typeof paymentMethod === "string" ? paymentMethod.toLowerCase() : "";
    if (
      typeof category !== "string" ||
      !category.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !methods.includes(method)
    )
      return res
        .status(400)
        .json({
          message:
            "Category, description, positive amount, and valid payment method are required",
        });
    const expenseDate = date ? new Date(date) : new Date();
    if (Number.isNaN(expenseDate.getTime()))
      return res.status(400).json({ message: "Invalid expense date" });
    idempotencyKey = req.get("Idempotency-Key") || randomUUID();
    const previous = await Expense.findOne({ idempotencyKey });
    if (previous) {
      const currentHash = createHash("sha256")
        .update(JSON.stringify(req.body || {}))
        .digest("hex");
      if (previous.requestHash && previous.requestHash !== currentHash)
        return res
          .status(409)
          .json({
            message: "Idempotency key already used for another expense",
          });
      return res
        .status(200)
        .json({ message: "Expense already recorded", expense: previous });
    }
    const requestHash = createHash("sha256")
      .update(JSON.stringify(req.body || {}))
      .digest("hex");
    session = await mongoose.startSession();
    let expense;
    await session.withTransaction(async () => {
      expense = new Expense({
        expenseNumber: `EXP-${randomUUID().slice(0, 12).toUpperCase()}`,
        idempotencyKey,
        requestHash,
        category: category.trim(),
        description: description.trim(),
        amount: Math.round(numericAmount * 100) / 100,
        date: expenseDate,
        paymentMethod: method,
        reference: typeof reference === "string" ? reference.trim() : "",
        createdBy: req.user._id,
      });
      await expense.save({ session });
      const payment = new Payment({
        paymentNumber: `PAY-${randomUUID().slice(0, 12).toUpperCase()}`,
        direction: "out",
        purpose: "expense",
        relatedType: "expense",
        relatedId: expense._id,
        amount: expense.amount,
        method,
        reference,
        createdBy: req.user._id,
      });
      await payment.save({ session });
      const accounts = {
        cash: "Cash",
        upi: "UPI clearing",
        card: "Card clearing",
        bank: "Bank",
        other: "Other payment clearing",
      };
      await writeLedgerEntries(
        session,
        makeLedgerRows({
          sourceType: "expense",
          sourceId: expense._id,
          reference: expense.expenseNumber,
          transactionType: "expense",
          createdBy: req.user._id,
          description: expense.description,
          debits: [
            { account: `Expense: ${expense.category}`, amount: expense.amount },
          ],
          credits: [
            {
              account: accounts[method],
              amount: expense.amount,
              paymentMethod: method,
            },
          ],
        }),
      );
    });
    return res.status(201).json({ message: "Expense recorded", expense });
  } catch (error) {
    if (error.code === 11000 && idempotencyKey) {
      const expense = await Expense.findOne({ idempotencyKey });
      if (expense)
        return res
          .status(200)
          .json({ message: "Expense already recorded", expense });
    }
    return res
      .status(error.name === "ValidationError" ? 400 : 500)
      .json({ message: error.message || "Could not record expense" });
  } finally {
    if (session) await session.endSession();
  }
};
