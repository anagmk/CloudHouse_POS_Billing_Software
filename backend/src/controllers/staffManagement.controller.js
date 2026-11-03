import User from "../models/User.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

export const getStaffById = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid staff member ID" });
  }

  try {
    const staffMember = await User.findById(req.params.id).select("-password");
    if (!staffMember || !["staff", "admin"].includes(staffMember.role)) {
      return res.status(404).json({ message: "Staff member not found" });
    }
    return res.status(200).json(staffMember);
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

export const createStaff = async (req, res) => {
  const username =
    typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const { password, role } = req.body || {};

  if (!username || !email || !password || !role) {
    return res.status(400).json({ message: "All fields are required" });
  }
  if (!["staff", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role must be staff or admin" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();

    return res.status(201).json({ message: "Staff created successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getAllStaff = async (req, res) => {
  try {
    const staffMembers = await User.find({
      role: { $in: ["staff", "admin"] },
    }).select("-password");
    return res.status(200).json(staffMembers);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateStaff = async (req, res) => {
  const { id } = req.params;
  const username =
    typeof req.body?.username === "string" ? req.body.username.trim() : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const { role, isActive } = req.body || {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid staff member ID" });
  }
  if (!username || !email || !role) {
    return res
      .status(400)
      .json({ message: "Username, email, and role are required" });
  }
  if (!["staff", "admin"].includes(role)) {
    return res.status(400).json({ message: "Role must be staff or admin" });
  }

  try {
    const updatedStaff = await User.findByIdAndUpdate(
      id,
      { username, email, role, isActive },
      { new: true },
    ).select("-password");

    if (!updatedStaff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    return res.status(200).json(updatedStaff);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteStaff = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid staff member ID" });
  }

  try {
    const deletedStaff = await User.findByIdAndDelete(id).select("-password");

    if (!deletedStaff) {
      return res.status(404).json({ message: "Staff member not found" });
    }

    return res
      .status(200)
      .json({ message: "Staff member deleted successfully", deletedStaff });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
