#!/usr/bin/env node
/**
 * Creates an empty backend folder structure (no code inside files).
 * Usage: node scaffold-backend.js [target-folder]   (default: pos-backend)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(process.argv[2] || "pos-backend");

const resources = ["auth", "user", "product", "supplier", "purchase", "bill", "return", "ledger", "report"];
const validated = ["auth", "user", "product", "supplier", "purchase", "bill", "return"];

const files = [
  "src/config/db.js",
  "src/config/env.js",

  "src/constants/roles.js",
  "src/constants/paymentModes.js",

  ...["User", "Product", "Supplier", "Purchase", "Bill", "Return", "LedgerEntry", "Counter"].map((m) => `src/models/${m}.js`),

  "src/routes/index.js",
  ...resources.map((r) => `src/routes/${r}.routes.js`),
  ...resources.map((r) => `src/controllers/${r}.controller.js`),
  ...resources.map((r) => `src/services/${r}.service.js`),
  ...validated.map((r) => `src/validators/${r}.validator.js`),

  "src/middlewares/auth.middleware.js",
  "src/middlewares/role.middleware.js",
  "src/middlewares/validate.middleware.js",
  "src/middlewares/error.middleware.js",

  "src/utils/ApiError.js",
  "src/utils/ApiResponse.js",
  "src/utils/asyncHandler.js",
  "src/utils/generateBillNumber.js",

  "src/seeds/seed.js",
  "src/app.js",
  "src/server.js",

  "tests/.gitkeep",
  ".env.example",
  ".gitignore",
  "package.json",
  "README.md",
];

let created = 0;
for (const rel of files) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, "");
    created++;
  }
}

console.log(`Created ${created} empty files in ${ROOT}`);
