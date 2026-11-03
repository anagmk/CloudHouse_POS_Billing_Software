import mongoose from "mongoose";
import Customer from "../models/Customer.model.js";
import Bill from "../models/Bill.model.js";

export const listCustomers = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const filter = search
      ? {
          $or: [
            {
              name: {
                $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                $options: "i",
              },
            },
            {
              phone: {
                $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                $options: "i",
              },
            },
            {
              email: {
                $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                $options: "i",
              },
            },
          ],
        }
      : {};
    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort({ name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);
    return res
      .status(200)
      .json({
        success: true,
        customers,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not load customers", error: error.message });
  }
};

export const getCustomer = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "Invalid customer ID" });
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });
    const [summary, recentBills] = await Promise.all([
      Bill.aggregate([
        {
          $match: {
            customerId: customer._id,
            isReturn: { $ne: true },
            isCancelled: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$totalAmount" },
            outstanding: { $sum: "$balanceDue" },
            transactions: { $sum: 1 },
          },
        },
      ]),
      Bill.find({ customerId: customer._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    return res
      .status(200)
      .json({
        customer,
        summary: summary[0] || {
          totalSales: 0,
          outstanding: 0,
          transactions: 0,
        },
        recentBills,
      });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not load customer", error: error.message });
  }
};

export const createCustomer = async (req, res) => {
  const { name, phone, email, address, notes } = req.body || {};
  if (typeof name !== "string" || !name.trim())
    return res.status(400).json({ message: "Customer name is required" });
  try {
    const customer = await Customer.create({
      name: name.trim(),
      phone,
      email,
      address,
      notes,
      createdBy: req.user._id,
    });
    return res.status(201).json({ customer });
  } catch (error) {
    if (error.name === "ValidationError")
      return res.status(400).json({ message: error.message });
    return res
      .status(500)
      .json({ message: "Could not create customer", error: error.message });
  }
};

export const updateCustomer = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "Invalid customer ID" });
  const allowed = ["name", "phone", "email", "address", "notes", "isActive"];
  const update = Object.fromEntries(
    Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)),
  );
  if (!Object.keys(update).length)
    return res
      .status(400)
      .json({ message: "No customer fields were provided" });
  if (
    update.name !== undefined &&
    (typeof update.name !== "string" || !update.name.trim())
  )
    return res.status(400).json({ message: "Customer name cannot be empty" });
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });
    return res.status(200).json({ customer });
  } catch (error) {
    return res
      .status(error.name === "ValidationError" ? 400 : 500)
      .json({ message: error.message });
  }
};
