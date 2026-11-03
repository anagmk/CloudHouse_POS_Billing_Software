import express from "express";
import { listLedger } from "../controllers/ledger.controller.js";
const router = express.Router();
router.get("/", listLedger);
export default router;
