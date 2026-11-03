import bcrypt from "bcrypt";
import BusinessSettings from "../models/BusinessSettings.model.js";

const allowedFields = [
  "storeName",
  "address",
  "phone",
  "email",
  "gstin",
  "receiptFooter",
  "defaultReorderLevel",
];

export const getSettings = async (_req, res) => {
  try {
    const settings = await BusinessSettings.findOneAndUpdate(
      { key: "business" },
      { $setOnInsert: { key: "business" } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    ).lean();
    return res.json({ settings });
  } catch (error) {
    return res
      .status(500)
      .json({
        message: "Could not load business settings",
        error: error.message,
      });
  }
};

export const updateSettings = async (req, res) => {
  const updates = Object.fromEntries(
    allowedFields
      .filter((field) => req.body?.[field] !== undefined)
      .map((field) => [field, req.body[field]]),
  );
  if (Object.keys(updates).length === 0)
    return res
      .status(400)
      .json({ message: "Provide at least one setting to update" });
  if (
    updates.defaultReorderLevel !== undefined &&
    (!Number.isFinite(Number(updates.defaultReorderLevel)) ||
      Number(updates.defaultReorderLevel) < 0)
  ) {
    return res
      .status(400)
      .json({ message: "Default reorder level must be a non-negative number" });
  }
  if (updates.email && !/^\S+@\S+\.\S+$/.test(updates.email))
    return res
      .status(400)
      .json({ message: "Enter a valid business email address" });
  try {
    const settings = await BusinessSettings.findOneAndUpdate(
      { key: "business" },
      { $set: updates, $setOnInsert: { key: "business" } },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    return res.json({ settings });
  } catch (error) {
    return res
      .status(error.name === "ValidationError" ? 400 : 500)
      .json({ message: error.message || "Could not save business settings" });
  }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    newPassword.length < 8
  ) {
    return res
      .status(400)
      .json({
        message:
          "Enter your current password and a new password of at least 8 characters",
      });
  }
  try {
    const user = req.user;
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(400).json({ message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    return res.json({ message: "Password updated successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Could not update password", error: error.message });
  }
};
