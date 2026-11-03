import express from "express";
import rolePermission from "../middlewares/role.middleware.js";
import {
  changePassword,
  getSettings,
  updateSettings,
} from "../controllers/settings.controller.js";

const router = express.Router();
router.get("/", getSettings);
router.put("/", rolePermission("admin"), updateSettings);
router.post("/password", changePassword);
export default router;
