import express from "express";
import authRoutes from "./auth.routes.js";
import productRoutes from "./product.route.js";
import rolePermission from "../middlewares/role.middleware.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import staffRoutes from "./staff.routes.js";
import billRoutes from "./bill.routes.js";
import supplierRoutes from "./supplier.routes.js";
import customerRoutes from "./customer.routes.js";
import purchaseRoutes from "./purchase.routes.js";
import expenseRoutes from "./expense.routes.js";
import ledgerRoutes from "./ledger.routes.js";
import reportRoutes from "./report.routes.js";
import stockRoutes from "./stock.routes.js";
import categoryRoutes from "./category.routes.js";
import settingsRoutes from "./settings.routes.js";

const routes = express.Router();

routes.use("/auth", authRoutes);
routes.use("/products", authMiddleware, rolePermission("admin"), productRoutes);
routes.use("/staff", authMiddleware, rolePermission("admin"), staffRoutes);
routes.use(
  "/bills",
  authMiddleware,
  rolePermission("admin", "staff"),
  billRoutes,
);
routes.use(
  "/suppliers",
  authMiddleware,
  rolePermission("admin"),
  supplierRoutes,
);
routes.use(
  "/customers",
  authMiddleware,
  rolePermission("admin", "staff"),
  customerRoutes,
);
routes.use(
  "/purchases",
  authMiddleware,
  rolePermission("admin"),
  purchaseRoutes,
);
routes.use("/expenses", authMiddleware, rolePermission("admin"), expenseRoutes);
routes.use("/ledger", authMiddleware, rolePermission("admin"), ledgerRoutes);
routes.use("/reports", authMiddleware, rolePermission("admin"), reportRoutes);
routes.use("/stock", authMiddleware, rolePermission("admin"), stockRoutes);
routes.use(
  "/categories",
  authMiddleware,
  rolePermission("admin"),
  categoryRoutes,
);
routes.use(
  "/settings",
  authMiddleware,
  rolePermission("admin", "staff"),
  settingsRoutes,
);

export default routes;
