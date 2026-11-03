import Bill from "../models/Bill.model.js";
import Purchase from "../models/Purchase.model.js";
import Product from "../models/product.model.js";
import Expense from "../models/Expense.model.js";
import StockMovement from "../models/StockMovement.model.js";

const dateMatch = (query, field = "createdAt") => {
  const match = {};
  if (query.from || query.to) {
    match[field] = {};
    if (query.from && !Number.isNaN(Date.parse(query.from)))
      match[field].$gte = new Date(query.from);
    if (query.to && !Number.isNaN(Date.parse(query.to)))
      match[field].$lte = new Date(`${query.to}T23:59:59.999`);
  }
  return match;
};

export const getBusinessReport = async (req, res) => {
  try {
    const billMatch = {
      isReturn: { $ne: true },
      isCancelled: { $ne: true },
      ...dateMatch(req.query),
    };
    const returnMatch = { isReturn: true, ...dateMatch(req.query) };
    const purchaseMatch = dateMatch(req.query);
    const expenseMatch = dateMatch(req.query, "date");
    const [
      sales,
      returns,
      purchases,
      expenses,
      products,
      stockMovements,
      salesByDay,
      salesByMethod,
      salesByProduct,
      purchasesBySupplier,
      purchasesByDay,
    ] = await Promise.all([
      Bill.aggregate([
        { $match: billMatch },
        {
          $group: {
            _id: null,
            transactionCount: { $sum: 1 },
            grossSales: { $sum: "$subtotal" },
            discounts: { $sum: "$discount" },
            gstCollected: { $sum: "$totalGst" },
            netSales: { $sum: { $subtract: ["$subtotal", "$discount"] } },
            totalBilled: { $sum: "$totalAmount" },
            cashReceived: { $sum: "$paidAmount" },
            receivables: { $sum: "$balanceDue" },
          },
        },
      ]),
      Bill.aggregate([
        { $match: returnMatch },
        {
          $group: {
            _id: null,
            refunds: { $sum: "$totalAmount" },
            transactions: { $sum: 1 },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: purchaseMatch },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: "$totalAmount" },
            paidPurchases: { $sum: "$paidAmount" },
            payables: { $sum: "$balanceDue" },
            count: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        { $match: expenseMatch },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Product.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            skuCount: { $sum: 1 },
            units: { $sum: "$stockQuantity" },
            stockValue: {
              $sum: {
                $multiply: ["$stockQuantity", { $ifNull: ["$costPrice", 0] }],
              },
            },
            lowStock: {
              $sum: {
                $cond: [
                  {
                    $lte: ["$stockQuantity", { $ifNull: ["$reorderLevel", 5] }],
                  },
                  1,
                  0,
                ],
              },
            },
            outOfStock: {
              $sum: { $cond: [{ $eq: ["$stockQuantity", 0] }, 1, 0] },
            },
          },
        },
      ]),
      StockMovement.aggregate([
        { $match: dateMatch(req.query, "createdAt") },
        {
          $group: {
            _id: "$movementType",
            count: { $sum: 1 },
            quantity: { $sum: "$quantityChange" },
            damagedQuantity: { $sum: "$damagedQuantity" },
          },
        },
      ]),
      Bill.aggregate([
        { $match: billMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            sales: { $sum: "$totalAmount" },
            transactions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Bill.aggregate([
        { $match: billMatch },
        { $unwind: { path: "$payments", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$payments.method", "unpaid"] },
            amount: { $sum: "$payments.amount" },
            payments: {
              $sum: { $cond: [{ $ifNull: ["$payments.amount", false] }, 1, 0] },
            },
          },
        },
        { $sort: { amount: -1 } },
      ]),
      Bill.aggregate([
        { $match: billMatch },
        { $unwind: "$products" },
        {
          $group: {
            _id: "$products.productId",
            name: { $first: "$products.name" },
            quantity: { $sum: "$products.quantity" },
            sales: { $sum: "$products.total" },
          },
        },
        { $sort: { sales: -1 } },
        { $limit: 50 },
      ]),
      Purchase.aggregate([
        { $match: purchaseMatch },
        {
          $group: {
            _id: "$supplierId",
            purchases: { $sum: 1 },
            total: { $sum: "$totalAmount" },
            paid: { $sum: "$paidAmount" },
            outstanding: { $sum: "$balanceDue" },
          },
        },
        { $sort: { total: -1 } },
        {
          $lookup: {
            from: "suppliers",
            localField: "_id",
            foreignField: "_id",
            as: "supplier",
          },
        },
        { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            supplier: { $ifNull: ["$supplier.name", "Unknown supplier"] },
            purchases: 1,
            total: 1,
            paid: 1,
            outstanding: 1,
          },
        },
      ]),
      Purchase.aggregate([
        { $match: purchaseMatch },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            total: { $sum: "$totalAmount" },
            paid: { $sum: "$paidAmount" },
            outstanding: { $sum: "$balanceDue" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const salesData = sales[0] || {};
    const purchaseData = purchases[0] || {};
    const expenseData = expenses[0] || {};
    const returnData = returns[0] || {};
    const stockData = products[0] || {};
    return res.json({
      period: { from: req.query.from || null, to: req.query.to || null },
      sales: {
        transactionCount: 0,
        grossSales: 0,
        discounts: 0,
        gstCollected: 0,
        netSales: 0,
        totalBilled: 0,
        cashReceived: 0,
        receivables: 0,
        ...salesData,
      },
      returns: returnData,
      purchases: purchaseData,
      purchasesBySupplier,
      purchasesByDay,
      expenses: expenseData,
      inventory: stockData,
      stockMovements,
      salesByDay,
      salesByMethod,
      salesByProduct,
      financial: {
        cashFlowIn: salesData.cashReceived || 0,
        cashFlowOut: purchaseData.paidPurchases || 0,
        operatingExpenses: expenseData.totalExpenses || 0,
        receivables: salesData.receivables || 0,
        payables: purchaseData.payables || 0,
        inventoryValue: stockData.stockValue || 0,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not generate report", error: error.message });
  }
};
