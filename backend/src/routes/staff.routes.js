import {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
} from "../controllers/staffManagement.controller.js";
import express from "express";
import authMiddleware from "../middlewares/auth.middleware.js";
import rolePermission from "../middlewares/role.middleware.js";

const router = express.Router();

router.post("/add", authMiddleware, rolePermission("admin"), createStaff);
router.get("/getAll", authMiddleware, rolePermission("admin"), getAllStaff);
router.get("/get/:id", authMiddleware, rolePermission("admin"), getStaffById);
router.put("/update/:id", authMiddleware, rolePermission("admin"), updateStaff);
router.delete(
  "/delete/:id",
  authMiddleware,
  rolePermission("admin"),
  deleteStaff,
);

export default router;
