import express from "express";
import {
  addPurchasePayment,
  createPurchase,
  listPurchases,
  receivePurchase,
} from "../controllers/purchase.controller.js";
const router = express.Router();
router.get("/", listPurchases);
router.post("/", createPurchase);
router.post("/:id/receive", receivePurchase);
router.post("/:id/payments", addPurchasePayment);
export default router;
