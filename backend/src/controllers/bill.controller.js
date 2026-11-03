import Bill from "../models/Bill.model.js";
import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Customer from "../models/Customer.model.js";
import Payment from "../models/Payment.model.js";
import LedgerEntry from "../models/LedgerEntry.model.js";
import { randomUUID, createHash } from "node:crypto";
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

export const getBillCatalog = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .select("name category price stockQuantity gstRate sku")
      .sort({ name: 1 })
      .lean();
    return res.status(200).json({ products });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Failed to load products for billing" });
  }
};

export const getBillHistory = async (req, res) => {
  try {
    const filter = req.user.role === "admin" ? {} : { createdBy: req.user._id };
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { billNumber: { $regex: safeSearch, $options: "i" } },
        { customerName: { $regex: safeSearch, $options: "i" } },
        { customerContact: { $regex: safeSearch, $options: "i" } },
      ];
    }
    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from && !Number.isNaN(Date.parse(req.query.from)))
        filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to && !Number.isNaN(Date.parse(req.query.to)))
        filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999`);
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const [bills, total] = await Promise.all([
      Bill.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("createdBy", "username")
        .lean(),
      Bill.countDocuments(filter),
    ]);
    return res
      .status(200)
      .json({
        bills,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load bill history" });
  }
};

export const createBill = async (req, res) => {
  let session;
  try {
    const body = req.body || {};
    const { products, customerId, customerName, customerContact } = body;
    const discount = body.discount ?? 0;
    const createdBy = req.user._id;
    if (!Array.isArray(products) || products.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one product is required" });
    }
    const idempotencyKey =
      req.get("Idempotency-Key") || body.idempotencyKey || randomUUID();
    const requestHash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const existingBill = await Bill.findOne({ idempotencyKey });
    if (existingBill) {
      if (
        existingBill.requestHash &&
        existingBill.requestHash !== requestHash
      ) {
        return res
          .status(409)
          .json({
            message:
              "This idempotency key was already used for another request",
          });
      }
      return res
        .status(200)
        .json({ message: "Bill already processed", bill: existingBill });
    }

    if (customerId && !mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ message: "Invalid customer ID" });
    }
    const productQuantities = new Map();
    for (const item of products) {
      if (
        !item ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return res
          .status(400)
          .json({ message: "Invalid product ID or quantity" });
      }
      const id = item.productId.toString();
      productQuantities.set(
        id,
        (productQuantities.get(id) || 0) + item.quantity,
      );
    }

    session = await mongoose.startSession();
    let newBill;
    await session.withTransaction(async () => {
      const productIds = [...productQuantities.keys()];
      const existingProducts = await Product.find({
        _id: { $in: productIds },
        isActive: true,
      }).session(session);
      if (existingProducts.length !== productIds.length) {
        throw new Error("One or more products do not exist or are inactive");
      }

      const customer = customerId
        ? await Customer.findOne({ _id: customerId, isActive: true }).session(
            session,
          )
        : null;
      if (customerId && !customer)
        throw new Error("Customer not found or inactive");

      let subtotal = 0;
      const billProducts = [];
      const productById = new Map(
        existingProducts.map((product) => [product._id.toString(), product]),
      );
      for (const [productId, quantity] of productQuantities) {
        const product = productById.get(productId);
        if (product.stockQuantity < quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`,
          );
        }
        const itemSubtotal = roundMoney(product.price * quantity);
        subtotal = roundMoney(subtotal + itemSubtotal);
        billProducts.push({
          productId: product._id,
          name: product.name,
          quantity,
          price: product.price,
          gstRate: product.gstRate,
          lineDiscount: 0,
          total: itemSubtotal,
        });
      }

      const discountAmount = Number(discount);
      if (
        !Number.isFinite(discountAmount) ||
        discountAmount < 0 ||
        discountAmount > subtotal
      ) {
        throw new Error("Discount must be between zero and the subtotal");
      }
      let totalGst = 0;
      let allocatedDiscount = 0;
      billProducts.forEach((line, index) => {
        const lineBase = line.price * line.quantity;
        const lineDiscount =
          index === billProducts.length - 1
            ? roundMoney(discountAmount - allocatedDiscount)
            : subtotal > 0
              ? roundMoney(discountAmount * (lineBase / subtotal))
              : 0;
        allocatedDiscount = roundMoney(allocatedDiscount + lineDiscount);
        const lineGst = roundMoney(
          (lineBase - lineDiscount) * (line.gstRate / 100),
        );
        line.lineDiscount = lineDiscount;
        line.total = roundMoney(lineBase - lineDiscount + lineGst);
        totalGst = roundMoney(totalGst + lineGst);
      });
      const totalAmount = roundMoney(subtotal - discountAmount + totalGst);

      let requestedPayments = Array.isArray(body.payments) ? body.payments : [];
      if (!Array.isArray(body.payments) && body.paymentMethod) {
        requestedPayments = [
          {
            method: body.paymentMethod,
            amount: body.paymentAmount ?? totalAmount,
            reference: body.paymentReference,
          },
        ];
      }
      const payments = requestedPayments.map((payment) => ({
        method:
          typeof payment?.method === "string"
            ? payment.method.toLowerCase()
            : "",
        amount: Number(payment?.amount),
        reference:
          typeof payment?.reference === "string"
            ? payment.reference.trim()
            : "",
      }));
      if (
        payments.some(
          (payment) =>
            !["cash", "upi", "card", "bank", "other"].includes(
              payment.method,
            ) ||
            !Number.isFinite(payment.amount) ||
            payment.amount <= 0,
        )
      ) {
        throw new Error(
          "Every payment must have a valid method and positive amount",
        );
      }
      const paidAmount = roundMoney(
        payments.reduce((sum, payment) => sum + payment.amount, 0),
      );
      if (paidAmount > totalAmount + 0.01)
        throw new Error("Payments cannot exceed the bill total");
      const amountTendered =
        body.amountTendered === undefined
          ? paidAmount
          : Number(body.amountTendered);
      if (!Number.isFinite(amountTendered) || amountTendered < paidAmount)
        throw new Error(
          "Amount tendered must be valid and at least the amount applied to the bill",
        );
      const changeDue = roundMoney(Math.max(0, amountTendered - paidAmount));
      if (
        changeDue > 0 &&
        !payments.some((payment) => payment.method === "cash")
      )
        throw new Error("Change can only be returned for a cash payment");
      if (changeDue > 0 && paidAmount < totalAmount)
        throw new Error(
          "Cash change is only valid when the bill is fully paid",
        );
      const balanceDue = roundMoney(Math.max(0, totalAmount - paidAmount));
      if (balanceDue > 0 && !customerId)
        throw new Error(
          "Select a customer to save a bill with an outstanding balance",
        );

      newBill = new Bill({
        billNumber: `SP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
        idempotencyKey,
        requestHash,
        createdBy,
        products: billProducts,
        subtotal,
        totalGst,
        discount: discountAmount,
        totalAmount,
        paymentMethod: payments.length === 1 ? payments[0].method : undefined,
        payments,
        paidAmount,
        amountTendered,
        changeDue,
        balanceDue,
        paymentStatus:
          balanceDue === 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
        customerId: customer?._id,
        customerName:
          typeof customerName === "string"
            ? customerName.trim()
            : customer?.name || "",
        customerContact:
          typeof customerContact === "string"
            ? customerContact.trim()
            : customer?.phone || "",
        isReturn: false,
        originalBillId: null,
      });
      await newBill.save({ session });

      for (const [productId, quantity] of productQuantities) {
        const result = await Product.updateOne(
          {
            _id: productId,
            isActive: true,
            stockQuantity: { $gte: quantity },
          },
          {
            $inc: { stockQuantity: -quantity },
          },
          { session },
        );

        if (result.modifiedCount !== 1) {
          throw new Error("Stock changed during checkout. Please try again.");
        }
        const product = existingProducts.find(
          (item) => item._id.toString() === productId,
        );
        await writeStockMovement(session, {
          movementKey: `bill:${newBill._id}:product:${productId}:sale`,
          productId,
          movementType: "sale",
          reason: "Stock sold on POS bill",
          quantityChange: -quantity,
          balanceAfter: product.stockQuantity - quantity,
          unitCost: product.costPrice,
          sourceType: "bill",
          sourceId: newBill._id,
          createdBy,
        });
      }

      await writePayments(session, {
        payments,
        direction: "in",
        purpose: "sale",
        relatedType: "bill",
        relatedId: newBill._id,
        partyType: customer ? "customer" : undefined,
        partyId: customer?._id,
        createdBy,
      });
      const paymentDebits = payments.map((payment) => ({
        account: paymentAccount[payment.method],
        amount: payment.amount,
        paymentMethod: payment.method,
      }));
      const debitRows = [...paymentDebits];
      if (balanceDue > 0)
        debitRows.push({ account: "Accounts receivable", amount: balanceDue });
      const ledgerRows = makeLedgerRows({
        sourceType: "bill",
        sourceId: newBill._id,
        reference: newBill.billNumber,
        transactionType: "sale",
        createdBy,
        partyType: customer ? "customer" : undefined,
        partyId: customer?._id,
        description: `Sale ${newBill.billNumber}`,
        debits: debitRows,
        credits: [
          {
            account: "Sales revenue",
            amount: roundMoney(subtotal - discountAmount),
          },
          { account: "GST payable", amount: totalGst },
        ],
      });
      await writeLedgerEntries(session, ledgerRows);
    });

    return res.status(201).json({
      message: "Bill created successfully",
      bill: await newBill.populate("createdBy", "username"),
    });
  } catch (error) {
    if (error.code === 11000 && req.get("Idempotency-Key")) {
      const existingBill = await Bill.findOne({
        idempotencyKey: req.get("Idempotency-Key"),
      });
      if (existingBill)
        return res
          .status(200)
          .json({ message: "Bill already processed", bill: existingBill });
    }
    const clientError =
      /Invalid|Insufficient|inactive|subtotal|Payments|Select a customer|Stock changed/.test(
        error.message,
      );
    return res
      .status(clientError ? 400 : 500)
      .json({ message: error.message || "Could not create bill" });
  } finally {
    if (session) await session.endSession();
  }
};

export const createReturn = async (req, res) => {
  let session;
  try {
    const body = req.body || {};
    const { originalBillId, products } = body;
    if (!originalBillId || !mongoose.isValidObjectId(originalBillId))
      return res
        .status(400)
        .json({ message: "Valid originalBillId is required" });
    if (!Array.isArray(products) || products.length === 0)
      return res
        .status(400)
        .json({ message: "At least one product is required" });
    const idempotencyKey =
      req.get("Idempotency-Key") || body.idempotencyKey || randomUUID();
    const requestHash = createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex");
    const previousIdempotentReturn = await Bill.findOne({
      idempotencyKey,
      isReturn: true,
    });
    if (previousIdempotentReturn) {
      if (
        previousIdempotentReturn.requestHash &&
        previousIdempotentReturn.requestHash !== requestHash
      )
        return res
          .status(409)
          .json({
            message:
              "This idempotency key was already used for another request",
          });
      return res
        .status(200)
        .json({
          message: "Return already processed",
          returnBill: previousIdempotentReturn,
        });
    }
    const returnQuantities = new Map();
    const restockQuantities = new Map();

    for (const item of products) {
      if (
        !item ||
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return res
          .status(400)
          .json({ message: "Invalid product ID or quantity" });
      }
      const id = item.productId.toString();
      returnQuantities.set(id, (returnQuantities.get(id) || 0) + item.quantity);
      if (item.restockable !== false)
        restockQuantities.set(
          id,
          (restockQuantities.get(id) || 0) + item.quantity,
        );
    }

    session = await mongoose.startSession();
    let returnBill;
    await session.withTransaction(async () => {
      const billFilter = { _id: originalBillId };
      if (req.user.role !== "admin") billFilter.createdBy = req.user._id;
      const originalBill = await Bill.findOne(billFilter).session(session);

      if (!originalBill) {
        throw new Error("Original bill not found");
      }

      if (originalBill.isReturn) {
        throw new Error("Cannot return products against another return bill");
      }
      if (originalBill.isCancelled)
        throw new Error("Cancelled bills cannot be returned");

      const previousReturns = await Bill.find({
        originalBillId: originalBill._id,
        isReturn: true,
      }).session(session);

      const originalProducts = new Map();

      for (const item of originalBill.products) {
        const id = item.productId.toString();

        originalProducts.set(
          id,
          (originalProducts.get(id) || 0) + item.quantity,
        );
      }

      const alreadyReturned = new Map();

      for (const previousReturn of previousReturns) {
        for (const item of previousReturn.products) {
          const id = item.productId.toString();

          alreadyReturned.set(
            id,
            (alreadyReturned.get(id) || 0) + item.quantity,
          );
        }
      }

      const productsToReturn = [];
      let subtotal = 0;
      let discount = 0;
      let totalGst = 0;

      for (const [productId, quantity] of returnQuantities) {
        const originalProduct = originalBill.products.find(
          (item) => item.productId.toString() === productId,
        );

        if (!originalProduct) {
          throw new Error("Product does not belong to the original bill");
        }

        const purchasedQuantity = originalProducts.get(productId);
        const returnedQuantity = alreadyReturned.get(productId) || 0;
        const remainingQuantity = purchasedQuantity - returnedQuantity;

        if (quantity > remainingQuantity) {
          throw new Error(`Only ${remainingQuantity} units can be returned`);
        }

        const itemSubtotal = roundMoney(originalProduct.price * quantity);
        const itemDiscount = roundMoney(
          ((originalProduct.lineDiscount || 0) * quantity) /
            originalProduct.quantity,
        );
        const itemGst = roundMoney(
          (itemSubtotal - itemDiscount) * (originalProduct.gstRate / 100),
        );
        const restockable =
          (restockQuantities.get(productId) || 0) === quantity;
        subtotal = roundMoney(subtotal + itemSubtotal);
        discount = roundMoney(discount + itemDiscount);
        totalGst = roundMoney(totalGst + itemGst);

        productsToReturn.push({
          productId: originalProduct.productId,
          name: originalProduct.name,
          quantity,
          price: originalProduct.price,
          gstRate: originalProduct.gstRate,
          lineDiscount: itemDiscount,
          restockable,
          total: roundMoney(itemSubtotal - itemDiscount + itemGst),
        });
      }

      const totalAmount = roundMoney(subtotal - discount + totalGst);
      let requestedPayments = Array.isArray(body.refundPayments)
        ? body.refundPayments
        : [];
      if (!requestedPayments.length && body.refundMethod)
        requestedPayments = [
          { method: body.refundMethod, amount: totalAmount },
        ];
      if (!requestedPayments.length && originalBill.paymentMethod)
        requestedPayments = [
          { method: originalBill.paymentMethod, amount: totalAmount },
        ];
      const refundPayments = requestedPayments.map((payment) => ({
        method:
          typeof payment?.method === "string"
            ? payment.method.toLowerCase()
            : "",
        amount: Number(payment?.amount),
        reference:
          typeof payment?.reference === "string"
            ? payment.reference.trim()
            : "",
      }));
      if (
        refundPayments.some(
          (payment) =>
            !["cash", "upi", "card", "bank", "other"].includes(
              payment.method,
            ) ||
            !Number.isFinite(payment.amount) ||
            payment.amount <= 0,
        )
      )
        throw new Error(
          "Refund payments must include a valid method and positive amount",
        );
      const paidAmount = roundMoney(
        refundPayments.reduce((sum, payment) => sum + payment.amount, 0),
      );
      if (paidAmount > totalAmount + 0.01)
        throw new Error("Refund payments cannot exceed the return value");
      const balanceDue = roundMoney(Math.max(0, totalAmount - paidAmount));

      returnBill = new Bill({
        billNumber: `RT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
        idempotencyKey,
        requestHash,
        createdBy: req.user._id,
        products: productsToReturn,
        subtotal,
        totalGst,
        discount,
        totalAmount,
        payments: refundPayments,
        paidAmount,
        balanceDue,
        paymentStatus:
          balanceDue === 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
        paymentMethod:
          refundPayments.length === 1 ? refundPayments[0].method : undefined,
        customerId: originalBill.customerId,
        customerName: originalBill.customerName,
        customerContact: originalBill.customerContact,
        isReturn: true,
        originalBillId: originalBill._id,
      });
      await returnBill.save({ session });

      for (const [productId, quantity] of restockQuantities) {
        const productBefore =
          await Product.findById(productId).session(session);
        if (!productBefore)
          throw new Error("Returned product no longer exists");
        const result = await Product.updateOne(
          { _id: productId },
          { $inc: { stockQuantity: quantity } },
          { session },
        );

        if (result.modifiedCount !== 1) {
          throw new Error("Failed to update returned product stock");
        }
        await writeStockMovement(session, {
          movementKey: `return:${returnBill._id}:product:${productId}:restock`,
          productId,
          movementType: "return",
          reason: "Resalable customer return",
          quantityChange: quantity,
          balanceAfter: productBefore.stockQuantity + quantity,
          unitCost: productBefore.costPrice,
          sourceType: "return",
          sourceId: returnBill._id,
          createdBy: req.user._id,
        });
      }

      for (const [productId, quantity] of returnQuantities) {
        const damagedQuantity =
          quantity - (restockQuantities.get(productId) || 0);
        if (damagedQuantity > 0) {
          const product = await Product.findById(productId).session(session);
          await writeStockMovement(session, {
            movementKey: `return:${returnBill._id}:product:${productId}:damaged`,
            productId,
            movementType: "damaged_return",
            reason: "Customer return marked as non-resalable",
            quantityChange: 0,
            damagedQuantity,
            balanceAfter: product?.stockQuantity || 0,
            sourceType: "return",
            sourceId: returnBill._id,
            createdBy: req.user._id,
            notes: `${damagedQuantity} unit(s) returned as damaged`,
          });
        }
      }

      await writePayments(session, {
        payments: refundPayments,
        direction: "out",
        purpose: "refund",
        relatedType: "bill",
        relatedId: returnBill._id,
        partyType: originalBill.customerId ? "customer" : undefined,
        partyId: originalBill.customerId,
        createdBy: req.user._id,
      });
      const debitRows = [
        { account: "Sales returns", amount: roundMoney(subtotal - discount) },
        { account: "GST payable", amount: totalGst },
      ];
      const creditRows = refundPayments.map((payment) => ({
        account: paymentAccount[payment.method],
        amount: payment.amount,
        paymentMethod: payment.method,
      }));
      if (balanceDue > 0)
        creditRows.push({ account: "Refunds payable", amount: balanceDue });
      await writeLedgerEntries(
        session,
        makeLedgerRows({
          sourceType: "bill",
          sourceId: returnBill._id,
          reference: returnBill.billNumber,
          transactionType: "refund",
          createdBy: req.user._id,
          partyType: originalBill.customerId ? "customer" : undefined,
          partyId: originalBill.customerId,
          description: `Refund for ${originalBill.billNumber || originalBill._id}`,
          debits: debitRows,
          credits: creditRows,
        }),
      );
      originalBill.returnVersion = (originalBill.returnVersion || 0) + 1;
      await originalBill.save({ session });
    });

    return res.status(201).json({
      message: "Product return completed successfully",
      returnBill,
    });
  } catch (error) {
    if (error.code === 11000 && req.get("Idempotency-Key")) {
      const existingReturn = await Bill.findOne({
        idempotencyKey: req.get("Idempotency-Key"),
        isReturn: true,
      });
      if (existingReturn)
        return res
          .status(200)
          .json({
            message: "Return already processed",
            returnBill: existingReturn,
          });
    }
    const clientError =
      /Invalid|not found|Cannot return|Only |cannot exceed|Valid |positive/.test(
        error.message,
      );
    return res
      .status(clientError ? 400 : 500)
      .json({ message: error.message || "Could not process return" });
  } finally {
    if (session) await session.endSession();
  }
};

export const addBillPayment = async (req, res) => {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid bill ID" });
    const { method, amount, reference } = req.body || {};
    const normalizedMethod =
      typeof method === "string" ? method.toLowerCase() : "";
    const paymentAmount = Number(amount);
    if (
      !["cash", "upi", "card", "bank", "other"].includes(normalizedMethod) ||
      !Number.isFinite(paymentAmount) ||
      paymentAmount <= 0
    ) {
      return res
        .status(400)
        .json({
          message: "A valid payment method and positive amount are required",
        });
    }
    const idempotencyKey = req.get("Idempotency-Key") || randomUUID();
    const existingPayment = await Payment.findOne({ idempotencyKey });
    if (existingPayment)
      return res
        .status(200)
        .json({
          message: "Payment already processed",
          payment: existingPayment,
        });

    session = await mongoose.startSession();
    let payment;
    let updatedBill;
    await session.withTransaction(async () => {
      const filter = { _id: req.params.id };
      if (req.user.role !== "admin") filter.createdBy = req.user._id;
      const bill = await Bill.findOne(filter).session(session);
      if (!bill || bill.isReturn || bill.isCancelled)
        throw new Error("Bill not found or cancelled");
      const outstandingBalance = bill.balanceDue ?? bill.totalAmount;
      if (paymentAmount > outstandingBalance + 0.01)
        throw new Error("Payment exceeds the outstanding balance");

      payment = new Payment({
        paymentNumber: `PAY-${randomUUID().slice(0, 12).toUpperCase()}`,
        idempotencyKey,
        direction: "in",
        purpose: "collection",
        relatedType: "bill",
        relatedId: bill._id,
        partyType: "customer",
        partyId: bill.customerId,
        amount: paymentAmount,
        method: normalizedMethod,
        reference: typeof reference === "string" ? reference.trim() : "",
        createdBy: req.user._id,
      });
      await payment.save({ session });

      bill.paidAmount = roundMoney((bill.paidAmount || 0) + paymentAmount);
      bill.balanceDue = roundMoney(
        Math.max(0, bill.totalAmount - bill.paidAmount),
      );
      bill.paymentStatus = bill.balanceDue === 0 ? "paid" : "partial";
      bill.payments.push({
        method: normalizedMethod,
        amount: paymentAmount,
        reference,
      });
      updatedBill = await bill.save({ session });

      await writeLedgerEntries(
        session,
        makeLedgerRows({
          sourceType: "payment",
          sourceId: payment._id,
          reference: payment.paymentNumber,
          transactionType: "payment",
          createdBy: req.user._id,
          partyType: "customer",
          partyId: bill.customerId,
          description: `Payment received for ${bill.billNumber || bill._id}`,
          debits: [
            {
              account: paymentAccount[normalizedMethod],
              amount: paymentAmount,
              paymentMethod: normalizedMethod,
            },
          ],
          credits: [{ account: "Accounts receivable", amount: paymentAmount }],
        }),
      );
    });

    return res
      .status(201)
      .json({ message: "Payment recorded", payment, bill: updatedBill });
  } catch (error) {
    if (error.code === 11000 && req.get("Idempotency-Key")) {
      const existingPayment = await Payment.findOne({
        idempotencyKey: req.get("Idempotency-Key"),
      });
      if (existingPayment)
        return res
          .status(200)
          .json({
            message: "Payment already processed",
            payment: existingPayment,
          });
    }
    const clientError = /Invalid|valid|positive|not found|exceeds/.test(
      error.message,
    );
    return res
      .status(clientError ? 400 : 500)
      .json({ message: error.message || "Could not record payment" });
  } finally {
    if (session) await session.endSession();
  }
};

export const cancelBill = async (req, res) => {
  let session;
  try {
    if (!mongoose.isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid bill ID" });
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!reason)
      return res
        .status(400)
        .json({ message: "A cancellation reason is required" });
    session = await mongoose.startSession();
    let cancelledBill;
    await session.withTransaction(async () => {
      const filter = { _id: req.params.id, isReturn: { $ne: true } };
      if (req.user.role !== "admin") filter.createdBy = req.user._id;
      const bill = await Bill.findOne(filter).session(session);
      if (!bill) throw new Error("Bill not found");
      if (bill.isCancelled) {
        cancelledBill = bill;
        return;
      }
      const linkedReturn = await Bill.exists({
        originalBillId: bill._id,
        isReturn: true,
      }).session(session);
      if (linkedReturn)
        throw new Error("A bill with processed returns cannot be cancelled");
      const movementRows = await Promise.all(
        bill.products.map(async (line) => {
          const product = await Product.findById(line.productId).session(
            session,
          );
          if (!product)
            throw new Error(`Product ${line.name} no longer exists`);
          const updated = await Product.updateOne(
            { _id: product._id },
            { $inc: { stockQuantity: line.quantity } },
            { session },
          );
          if (updated.modifiedCount !== 1)
            throw new Error(`Could not restore stock for ${line.name}`);
          await writeStockMovement(session, {
            movementKey: `bill:${bill._id}:product:${product._id}:cancel`,
            productId: product._id,
            movementType: "cancellation",
            reason: `Sale cancelled: ${reason}`,
            quantityChange: line.quantity,
            balanceAfter: product.stockQuantity + line.quantity,
            unitCost: product.costPrice,
            sourceType: "bill",
            sourceId: bill._id,
            createdBy: req.user._id,
          });
          return product;
        }),
      );
      void movementRows;
      const paymentRows = bill.payments?.length
        ? bill.payments
        : bill.paymentMethod && bill.paidAmount > 0
          ? [{ method: bill.paymentMethod, amount: bill.paidAmount }]
          : [];
      await writePayments(session, {
        payments: paymentRows,
        direction: "out",
        purpose: "refund",
        relatedType: "bill",
        relatedId: bill._id,
        partyType: bill.customerId ? "customer" : undefined,
        partyId: bill.customerId,
        createdBy: req.user._id,
      });
      const reversalDebits = [
        {
          account: "Sales revenue",
          amount: roundMoney(bill.subtotal - bill.discount),
        },
        { account: "GST payable", amount: bill.totalGst },
      ];
      const reversalCredits = paymentRows.map((payment) => ({
        account: paymentAccount[payment.method] || "Other payment clearing",
        amount: payment.amount,
        paymentMethod: payment.method,
      }));
      if (bill.balanceDue > 0)
        reversalCredits.push({
          account: "Accounts receivable",
          amount: bill.balanceDue,
        });
      await writeLedgerEntries(
        session,
        makeLedgerRows({
          sourceType: "bill",
          sourceId: bill._id,
          reference: bill.billNumber || bill._id.toString(),
          transactionType: "adjustment",
          createdBy: req.user._id,
          partyType: bill.customerId ? "customer" : undefined,
          partyId: bill.customerId,
          description: `Cancellation reversal for ${bill.billNumber || bill._id}`,
          debits: reversalDebits,
          credits: reversalCredits,
        }),
      );
      bill.isCancelled = true;
      bill.cancellationReason = reason;
      bill.cancelledBy = req.user._id;
      bill.cancelledAt = new Date();
      cancelledBill = await bill.save({ session });
    });
    return res
      .status(200)
      .json({ message: "Bill cancelled and reversed", bill: cancelledBill });
  } catch (error) {
    return res
      .status(
        /not found|returns cannot|no longer exists/.test(error.message)
          ? 400
          : 500,
      )
      .json({ message: error.message || "Could not cancel bill" });
  } finally {
    if (session) await session.endSession();
  }
};

export default createReturn;
export { createReturn as returnBill };
