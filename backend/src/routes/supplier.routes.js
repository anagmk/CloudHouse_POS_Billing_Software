import {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
} from "../controllers/supplierMangement.controller.js";

import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import rolePermission from "../middlewares/role.middleware.js";

const router = express.Router();

router.post("/add", authMiddleware, rolePermission("admin"), createSupplier);
router.get("/getAll", authMiddleware, rolePermission("admin"), getAllSuppliers);
router.get(
  "/get/:id",
  authMiddleware,
  rolePermission("admin"),
  getSupplierById,
);
router.put(
  "/update/:id",
  authMiddleware,
  rolePermission("admin"),
  updateSupplier,
);
router.delete(
  "/delete/:id",
  authMiddleware,
  rolePermission("admin"),
  deleteSupplier,
);

export default router;
