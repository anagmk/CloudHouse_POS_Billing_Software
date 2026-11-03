import express from "express";
import { getBusinessReport } from "../controllers/report.controller.js";
const router = express.Router();
router.get("/", getBusinessReport);
export default router;
