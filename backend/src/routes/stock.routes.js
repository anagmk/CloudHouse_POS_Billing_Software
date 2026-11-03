import express from "express";
import {
  adjustStock,
  listStockMovements,
} from "../controllers/stock.controller.js";
const router = express.Router();
router.get("/movements", listStockMovements);
router.post("/adjustments", adjustStock);
export default router;
