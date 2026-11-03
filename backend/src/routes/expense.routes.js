import express from "express";
import {
  createExpense,
  listExpenses,
} from "../controllers/expense.controller.js";
const router = express.Router();
router.get("/", listExpenses);
router.post("/", createExpense);
export default router;
