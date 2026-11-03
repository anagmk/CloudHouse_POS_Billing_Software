import express from "express";
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "../controllers/customer.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import rolePermission from "../middlewares/role.middleware.js";

const router = express.Router();
router.use(authMiddleware, rolePermission("admin", "staff"));
router.get("/", listCustomers);
router.post("/", createCustomer);
router.get("/:id", getCustomer);
router.put("/:id", updateCustomer);
export default router;
