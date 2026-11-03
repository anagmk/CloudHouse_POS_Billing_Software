import mongoose from "mongoose";
import Category from "../models/Category.model.js";
import Product from "../models/product.model.js";

export const listCategories = async (req, res) => {
  try {
    const names = await Product.distinct("category", {
      category: { $type: "string", $ne: "" },
    });
    if (names.length) {
      await Category.bulkWrite(
        names.map((name) => ({
          updateOne: {
            filter: { name },
            update: { $setOnInsert: { name, createdBy: req.user._id } },
            upsert: true,
          },
        })),
      );
    }
    const [categories, counts] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      Product.aggregate([
        { $group: { _id: "$category", productCount: { $sum: 1 } } },
      ]),
    ]);
    const countByName = new Map(
      counts.map((item) => [item._id, item.productCount]),
    );
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().toLowerCase()
        : "";
    const filtered = categories
      .filter(
        (item) =>
          (!search ||
            item.name.toLowerCase().includes(search) ||
            item.description.toLowerCase().includes(search)) &&
          (req.query.status === "active"
            ? item.isActive
            : req.query.status === "inactive"
              ? !item.isActive
              : true),
      )
      .map((item) => ({
        ...item,
        productCount: countByName.get(item.name) || 0,
      }));
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    return res.json({
      categories: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not load categories", error: error.message });
  }
};

export const createCategory = async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const description =
    typeof req.body?.description === "string"
      ? req.body.description.trim()
      : "";
  if (!name)
    return res.status(400).json({ message: "Category name is required" });
  try {
    const category = await Category.create({
      name,
      description,
      createdBy: req.user._id,
    });
    return res
      .status(201)
      .json({ category: { ...category.toObject(), productCount: 0 } });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: "A category with that name already exists" });
    return res
      .status(error.name === "ValidationError" ? 400 : 500)
      .json({ message: error.message || "Could not create category" });
  }
};

export const updateCategory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "Invalid category ID" });
  const name =
    typeof req.body?.name === "string" ? req.body.name.trim() : undefined;
  const description =
    typeof req.body?.description === "string"
      ? req.body.description.trim()
      : undefined;
  const isActive = req.body?.isActive;
  if (name === "" || (isActive !== undefined && typeof isActive !== "boolean"))
    return res
      .status(400)
      .json({ message: "Provide a valid category name and status" });
  const session = await mongoose.startSession();
  let category;
  try {
    await session.withTransaction(async () => {
      category = await Category.findById(req.params.id).session(session);
      if (!category) throw new Error("Category not found");
      const oldName = category.name;
      if (name && name !== oldName) {
        const duplicate = await Category.exists({
          name,
          _id: { $ne: category._id },
        }).session(session);
        if (duplicate)
          throw new Error("A category with that name already exists");
        await Product.updateMany(
          { category: oldName },
          { $set: { category: name } },
          { session },
        );
        category.name = name;
      }
      if (description !== undefined) category.description = description;
      if (isActive !== undefined) category.isActive = isActive;
      await category.save({ session });
    });
    const productCount = await Product.countDocuments({
      category: category.name,
    });
    return res.json({ category: { ...category.toObject(), productCount } });
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: "A category with that name already exists" });
    const status = /not found/.test(error.message)
      ? 404
      : error.name === "ValidationError" || /already exists/.test(error.message)
        ? 400
        : 500;
    return res
      .status(status)
      .json({ message: error.message || "Could not update category" });
  } finally {
    await session.endSession();
  }
};

export const deleteCategory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id))
    return res.status(400).json({ message: "Invalid category ID" });
  try {
    const category = await Category.findById(req.params.id);
    if (!category)
      return res.status(404).json({ message: "Category not found" });
    const productCount = await Product.countDocuments({
      category: category.name,
    });
    if (productCount)
      return res
        .status(409)
        .json({
          message: "Reassign products in this category before deleting it",
          productCount,
        });
    await category.deleteOne();
    return res.json({ message: "Category deleted" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not delete category", error: error.message });
  }
};
