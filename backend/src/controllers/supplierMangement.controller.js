import Supplier from "../models/Supplier.model.js";
import mongoose from "mongoose";

export const createSupplier = async (req, res) => {
  const {
    name,
    companyName,
    email,
    phone,
    alternatePhone,
    gstNumber,
    address,
    paymentTerms,
    notes,
  } = req.body || {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof phone !== "string" ||
    !phone.trim()
  ) {
    return res.status(400).json({ message: "Name and phone are required" });
  }

  try {
    const supplierExists = await Supplier.findOne({
      name: name.trim(),
      phone: phone.trim(),
      gstNumber: gstNumber ? gstNumber.trim() : undefined,
    });
    if (supplierExists) {
      return res
        .status(400)
        .json({ message: "Supplier with this name and phone already exists" });
    }

    const newSupplier = new Supplier({
      name,
      companyName,
      email,
      phone,
      alternatePhone,
      gstNumber,
      address,
      paymentTerms,
      notes,
    });

    const savedSupplier = await newSupplier.save();
    return res.status(201).json(savedSupplier);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Supplier already exists" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAllSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    return res.status(200).json(suppliers);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getSupplierById = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid supplier ID" });
  }
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    return res.status(200).json(supplier);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid supplier ID" });
    }

    const allowedFields = [
      "name",
      "companyName",
      "email",
      "phone",
      "alternatePhone",
      "gstNumber",
      "address",
      "paymentTerms",
      "notes",
      "isActive",
    ];
    const update = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) =>
        allowedFields.includes(key),
      ),
    );
    if (!Object.keys(update).length) {
      return res
        .status(400)
        .json({ message: "No supplier fields were provided" });
    }
    if (
      update.name !== undefined &&
      (typeof update.name !== "string" || !update.name.trim())
    ) {
      return res.status(400).json({ message: "Supplier name cannot be empty" });
    }
    if (
      update.phone !== undefined &&
      (typeof update.phone !== "string" || !update.phone.trim())
    ) {
      return res
        .status(400)
        .json({ message: "Supplier phone cannot be empty" });
    }

    const updatedSupplier = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!updatedSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    return res.status(200).json(updatedSupplier);
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: "Supplier already exists" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteSupplier = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid supplier ID" });
  }
  try {
    const deletedSupplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!deletedSupplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    return res.status(200).json({ message: "Supplier deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
