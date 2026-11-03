import {
  createBill,
  createReturn,
  getBillHistory,
  getBillCatalog,
  addBillPayment,
  cancelBill,
} from "../controllers/bill.controller.js";
import express from "express";
import rolePermission from "../middlewares/role.middleware.js";

const router = express.Router();

router.get("/catalog", getBillCatalog);
router.get("/history", getBillHistory);
router.post("/create", createBill);
router.post("/return", rolePermission("admin"), createReturn);
router.post("/:id/payments", addBillPayment);
router.post("/:id/cancel", rolePermission("admin"), cancelBill);

export default router;
