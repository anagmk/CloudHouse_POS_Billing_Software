import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import Bill from "../models/Bill.model.js";
import Category from "../models/Category.model.js";
import Customer from "../models/Customer.model.js";
import Expense from "../models/Expense.model.js";
import LedgerEntry from "../models/LedgerEntry.model.js";
import Payment from "../models/Payment.model.js";
import Product from "../models/product.model.js";
import Purchase from "../models/Purchase.model.js";
import StockMovement from "../models/StockMovement.model.js";
import Supplier from "../models/Supplier.model.js";
import User from "../models/User.js";
import { connectDB } from "../config/db.js";
import { makeLedgerRows } from "../utils/financialRecords.js";
import {
  categoryCatalog,
  customerFirstNames,
  customerLastNames,
  productCatalog,
  supplierCatalog,
} from "./data/catalog.js";
import {
  createPayments,
  dateAt,
  makeRandom,
  paymentAccount,
  roundMoney,
  SEED_EMAIL_DOMAIN,
  SEED_MARKER,
  summarizeCounts,
} from "./seed.utils.js";

const EXPECTED_COUNTS = {
  admins: 1,
  staff: 5,
  categories: 12,
  suppliers: 10,
  products: 100,
  customers: 50,
  purchases: 30,
  bills: 150,
  expenses: 30,
};

const paymentMethods = ["cash", "upi", "card", "bank", "other"];
const resetRequested = process.argv.includes("--reset");
const random = makeRandom();
const number = (value) => String(value).padStart(4, "0");
const supplierEmailPattern =
  /^supplier\d{4}@suppliers\.stockpilot-seed\.invalid$/;
const customerEmailPattern =
  /^customer\d{4}@customers\.stockpilot-seed\.invalid$/;
const seededBillPattern = /^SP-SEED-/;
const seededPurchasePattern = /^PO-SEED-/;
const seededExpensePattern = /^EXP-SEED-/;
const seededProductPattern = /^SP-SEED-/;
const seededCategoryDescription = `${SEED_MARKER}:`;

const getCredentials = () => {
  const admin = {
    username: process.env.SEED_ADMIN_USERNAME || "StockPilot Demo Admin",
    email: process.env.SEED_ADMIN_EMAIL || `admin@${SEED_EMAIL_DOMAIN}`,
    password: process.env.SEED_ADMIN_PASSWORD || "DemoAdmin!2026",
  };
  const staffPassword = process.env.SEED_STAFF_PASSWORD || "DemoStaff!2026";

  if (!admin.email.endsWith(`@${SEED_EMAIL_DOMAIN}`)) {
    throw new Error(
      `SEED_ADMIN_EMAIL must use the reserved @${SEED_EMAIL_DOMAIN} domain so reset can identify the development account safely.`,
    );
  }
  if (admin.password.length < 8 || staffPassword.length < 8) {
    throw new Error("Seed passwords must contain at least 8 characters.");
  }

  return { admin, staffPassword };
};

const assertDevelopmentEnvironment = () => {
  if (process.env.NODE_ENV !== "development") {
    throw new Error(
      "Seeding is allowed only when NODE_ENV=development. Set it explicitly before running this command.",
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required to seed the development database.",
    );
  }
};

const seedUserFilter = (credentials) => ({
  $or: [
    {
      email: credentials.admin.email,
      username: credentials.admin.username,
      role: "admin",
    },
    ...Array.from({ length: EXPECTED_COUNTS.staff }, (_, index) => ({
      email: `staff${number(index + 1)}@${SEED_EMAIL_DOMAIN}`,
      username: `Demo Staff ${number(index + 1)}`,
      role: "staff",
    })),
  ],
});

const getExistingSeedData = async (session) => {
  const options = session ? { session } : {};
  const users = await User.find(
    seedUserFilter(getCredentials()),
    null,
    options,
  );
  const categories = await Category.find(
    { description: { $regex: `^${seededCategoryDescription}` } },
    null,
    options,
  );
  const suppliers = await Supplier.find(
    {
      email: { $regex: supplierEmailPattern },
      notes: { $regex: `^${SEED_MARKER}:` },
    },
    null,
    options,
  );
  const products = await Product.find(
    { sku: { $regex: seededProductPattern } },
    null,
    options,
  );
  const customers = await Customer.find(
    {
      email: { $regex: customerEmailPattern },
      notes: { $regex: `^${SEED_MARKER}:` },
    },
    null,
    options,
  );
  const purchases = await Purchase.find(
    { purchaseNumber: { $regex: seededPurchasePattern } },
    null,
    options,
  );
  const bills = await Bill.find(
    { billNumber: { $regex: seededBillPattern } },
    null,
    options,
  );
  const expenses = await Expense.find(
    { expenseNumber: { $regex: seededExpensePattern } },
    null,
    options,
  );

  return {
    users,
    categories,
    suppliers,
    products,
    customers,
    purchases,
    bills,
    expenses,
  };
};

const hasSeedRecords = (records) =>
  Object.values(records).some((collection) => collection.length > 0);

const isCompleteSeed = (records) =>
  records.users.filter((user) => user.role === "admin").length ===
    EXPECTED_COUNTS.admins &&
  records.users.filter((user) => user.role === "staff").length ===
    EXPECTED_COUNTS.staff &&
  records.suppliers.length === EXPECTED_COUNTS.suppliers &&
  records.products.length === EXPECTED_COUNTS.products &&
  records.customers.length === EXPECTED_COUNTS.customers &&
  records.purchases.length === EXPECTED_COUNTS.purchases &&
  records.bills.length === EXPECTED_COUNTS.bills &&
  records.expenses.length === EXPECTED_COUNTS.expenses;

const assertResetIsSafe = async (records, session) => {
  const userIds = records.users.map((user) => user._id);
  const productIds = records.products.map((product) => product._id);
  const customerIds = records.customers.map((customer) => customer._id);
  const supplierIds = records.suppliers.map((supplier) => supplier._id);
  const transactionIds = [
    ...records.bills.map((item) => item._id),
    ...records.purchases.map((item) => item._id),
    ...records.expenses.map((item) => item._id),
  ];
  const queryOptions = { session, projection: { _id: 1 } };
  const checks = [];

  if (productIds.length) {
    checks.push(
      Bill.exists({
        "products.productId": { $in: productIds },
        billNumber: { $not: seededBillPattern },
      }).session(session),
      Purchase.exists({
        "products.productId": { $in: productIds },
        purchaseNumber: { $not: seededPurchasePattern },
      }).session(session),
      StockMovement.exists({
        productId: { $in: productIds },
        movementKey: { $not: /^seed:/ },
      }).session(session),
      Product.find(
        {
          $or: [
            { _id: { $nin: productIds }, createdBy: { $in: userIds } },
            {
              supplierId: { $in: supplierIds },
              sku: { $not: seededProductPattern },
            },
          ],
        },
        null,
        queryOptions,
      ),
    );
  }
  if (customerIds.length) {
    checks.push(
      Bill.exists({
        customerId: { $in: customerIds },
        billNumber: { $not: seededBillPattern },
      }).session(session),
    );
  }
  if (supplierIds.length) {
    checks.push(
      Purchase.exists({
        supplierId: { $in: supplierIds },
        purchaseNumber: { $not: seededPurchasePattern },
      }).session(session),
      Product.exists({
        supplierId: { $in: supplierIds },
        sku: { $not: seededProductPattern },
      }).session(session),
    );
  }
  if (transactionIds.length) {
    checks.push(
      Payment.exists({
        relatedId: { $in: transactionIds },
        paymentNumber: { $not: /^PAY-SEED-/ },
      }).session(session),
      LedgerEntry.exists({
        sourceId: { $in: transactionIds },
        entryKey: { $not: /^seed:/ },
      }).session(session),
    );
  }
  if (userIds.length) {
    checks.push(
      Category.find(
        {
          createdBy: { $in: userIds },
          description: { $not: new RegExp(`^${seededCategoryDescription}`) },
        },
        null,
        queryOptions,
      ),
      Customer.find(
        { createdBy: { $in: userIds }, email: { $not: customerEmailPattern } },
        null,
        queryOptions,
      ),
      Bill.find(
        {
          createdBy: { $in: userIds },
          billNumber: { $not: seededBillPattern },
        },
        null,
        queryOptions,
      ),
      Purchase.find(
        {
          createdBy: { $in: userIds },
          purchaseNumber: { $not: seededPurchasePattern },
        },
        null,
        queryOptions,
      ),
      Expense.find(
        {
          createdBy: { $in: userIds },
          expenseNumber: { $not: seededExpensePattern },
        },
        null,
        queryOptions,
      ),
      Payment.find(
        { createdBy: { $in: userIds }, paymentNumber: { $not: /^PAY-SEED-/ } },
        null,
        queryOptions,
      ),
      LedgerEntry.find(
        {
          createdBy: { $in: userIds },
          sourceId: { $nin: transactionIds },
        },
        null,
        queryOptions,
      ),
      StockMovement.find(
        {
          createdBy: { $in: userIds },
          sourceId: { $nin: transactionIds },
          movementKey: { $not: /^seed:/ },
        },
        null,
        queryOptions,
      ),
    );
    const externallyUsedCategories = await Product.distinct(
      "category",
      { sku: { $not: seededProductPattern } },
      { session },
    );
    if (externallyUsedCategories.length) {
      checks.push(
        Category.exists({
          description: { $regex: `^${seededCategoryDescription}` },
          name: { $in: externallyUsedCategories },
        }).session(session),
      );
    }
  }

  const results = [];
  for (const check of checks) {
    results.push(await check);
  }
  const hasExternalReferences = results.some((result) => {
    if (Array.isArray(result)) return result.length > 0;
    return Boolean(result);
  });

  if (hasExternalReferences) {
    throw new Error(
      "Reset stopped: non-seed business records depend on seed users, products, customers, or suppliers. No records were removed.",
    );
  }
};

const clearSeedRecords = async (records, session) => {
  const options = { session };
  const billIds = records.bills.map((item) => item._id);
  const purchaseIds = records.purchases.map((item) => item._id);
  const expenseIds = records.expenses.map((item) => item._id);
  const transactionIds = [...billIds, ...purchaseIds, ...expenseIds];
  const productIds = records.products.map((item) => item._id);

  await LedgerEntry.deleteMany(
    {
      $or: [
        { sourceId: { $in: transactionIds } },
        { entryKey: { $regex: /^seed:/ } },
      ],
    },
    options,
  );
  await Payment.deleteMany(
    {
      $or: [
        { relatedType: "bill", relatedId: { $in: billIds } },
        { relatedType: "purchase", relatedId: { $in: purchaseIds } },
        { relatedType: "expense", relatedId: { $in: expenseIds } },
        { paymentNumber: { $regex: /^PAY-SEED-/ } },
      ],
    },
    options,
  );
  await StockMovement.deleteMany(
    {
      $or: [
        { sourceId: { $in: [...billIds, ...purchaseIds] } },
        { movementKey: { $regex: /^seed:/ } },
      ],
    },
    options,
  );

  await Bill.deleteMany({ _id: { $in: billIds } }, options);
  await Purchase.deleteMany({ _id: { $in: purchaseIds } }, options);
  await Expense.deleteMany({ _id: { $in: expenseIds } }, options);
  await Product.deleteMany({ _id: { $in: productIds } }, options);
  await Customer.deleteMany(
    { _id: { $in: records.customers.map((item) => item._id) } },
    options,
  );
  await Supplier.deleteMany(
    { _id: { $in: records.suppliers.map((item) => item._id) } },
    options,
  );
  const usedCategoryNames = await Product.distinct("category", {}, options);
  await Category.deleteMany(
    {
      _id: { $in: records.categories.map((item) => item._id) },
      name: { $nin: usedCategoryNames },
    },
    options,
  );
  await User.deleteMany(
    { _id: { $in: records.users.map((item) => item._id) } },
    options,
  );
};

const getProductTemplates = () => {
  const templates = productCatalog.flatMap((category, categoryIndex) =>
    category.products
      .slice(0, categoryIndex < 4 ? 9 : 8)
      .map(([name, price, gstRate]) => ({
        name,
        price,
        gstRate,
        category: category.category,
      })),
  );

  if (templates.length !== EXPECTED_COUNTS.products) {
    throw new Error(
      `Expected 100 product templates; found ${templates.length}.`,
    );
  }
  return templates;
};

const makeLedgerEntries = (args, date) =>
  makeLedgerRows(args).map(
    (row, index) =>
      new LedgerEntry({
        ...row,
        entryKey: `seed:${row.sourceType}:${row.reference}:${row.transactionType}:${index}`,
        date,
      }),
  );

const makePaymentDocuments = ({
  rows,
  relatedType,
  relatedId,
  purpose,
  direction,
  partyType,
  partyId,
  createdBy,
  date,
  prefix,
}) =>
  rows.map(
    (payment, index) =>
      new Payment({
        paymentNumber: `PAY-SEED-${prefix}-${number(index + 1)}`,
        direction,
        purpose,
        relatedType,
        relatedId,
        partyType,
        partyId,
        amount: payment.amount,
        method: payment.method,
        reference: `DEMO-${prefix}-${index + 1}`,
        createdBy,
        createdAt: date,
        updatedAt: date,
      }),
  );

const createSeedUsers = async (session, credentials) => {
  const adminPassword = await bcrypt.hash(credentials.admin.password, 10);
  const staffPassword = await bcrypt.hash(credentials.staffPassword, 10);
  const users = [
    new User({
      username: credentials.admin.username,
      email: credentials.admin.email,
      password: adminPassword,
      role: "admin",
      isActive: true,
    }),
  ];

  for (let index = 0; index < EXPECTED_COUNTS.staff; index += 1) {
    users.push(
      new User({
        username: `Demo Staff ${number(index + 1)}`,
        email: `staff${number(index + 1)}@${SEED_EMAIL_DOMAIN}`,
        password: staffPassword,
        role: "staff",
        isActive: true,
      }),
    );
  }

  return User.insertMany(users, { session });
};

const createSeedCategories = async (session, adminId) => {
  const categories = [];
  for (const definition of categoryCatalog) {
    const current = await Category.findOne({ name: definition.name }).session(
      session,
    );
    if (current) {
      categories.push(current);
      continue;
    }

    const category = new Category({
      ...definition,
      description: `${seededCategoryDescription} ${definition.description}`,
      createdBy: adminId,
      isActive: true,
    });
    await category.save({ session });
    categories.push(category);
  }
  return categories;
};

const createSeedSuppliers = async (session) => {
  const cities = [
    ["Pune", "Maharashtra"],
    ["Jaipur", "Rajasthan"],
    ["Kochi", "Kerala"],
    ["Indore", "Madhya Pradesh"],
    ["Surat", "Gujarat"],
    ["Mysuru", "Karnataka"],
    ["Nagpur", "Maharashtra"],
    ["Coimbatore", "Tamil Nadu"],
    ["Lucknow", "Uttar Pradesh"],
    ["Bhubaneswar", "Odisha"],
  ];
  const terms = ["Cash", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"];
  const suppliers = supplierCatalog.map(([name, companyName], index) => {
    const [city, state] = cities[index];
    return new Supplier({
      name,
      companyName,
      email: `supplier${number(index + 1)}@suppliers.${SEED_EMAIL_DOMAIN}`,
      phone: `+91-00000-${String(10001 + index).slice(-5)}`,
      alternatePhone: `+91-00000-${String(20001 + index).slice(-5)}`,
      gstNumber: `${String(index + 1).padStart(2, "0")}ABCDE0000F1Z5`,
      address: {
        street: `${20 + index} Demo Trade Park`,
        city,
        state,
        pincode: String(400000 + index * 123),
        country: "India",
      },
      paymentTerms: terms[index % terms.length],
      notes: `${SEED_MARKER}: fictional supplier record`,
      isActive: true,
    });
  });

  return Supplier.insertMany(suppliers, { session });
};

const createSeedProducts = async (session, users, suppliers) => {
  const templates = getProductTemplates();
  const products = templates.map((template, index) => {
    const initialStock = index === 0 ? 0 : index === 1 ? 4 : 30 + (index % 21);
    const costPrice = roundMoney(template.price * (0.58 + (index % 8) * 0.025));
    return new Product({
      createdBy: users[0]._id,
      supplierId: suppliers[index % suppliers.length]._id,
      name: template.name,
      price: template.price,
      costPrice,
      category: template.category,
      stockQuantity: initialStock,
      reorderLevel: 5,
      sku: `SP-SEED-${number(index + 1)}`,
      gstRate: template.gstRate,
      isActive: true,
    });
  });

  return Product.insertMany(products, { session });
};

const createSeedCustomers = async (session, users) => {
  const cities = [
    ["Pune", "Maharashtra"],
    ["Jaipur", "Rajasthan"],
    ["Kochi", "Kerala"],
    ["Indore", "Madhya Pradesh"],
    ["Surat", "Gujarat"],
    ["Mysuru", "Karnataka"],
    ["Nagpur", "Maharashtra"],
    ["Coimbatore", "Tamil Nadu"],
    ["Lucknow", "Uttar Pradesh"],
    ["Bhubaneswar", "Odisha"],
  ];
  const customers = Array.from(
    { length: EXPECTED_COUNTS.customers },
    (_, index) => {
      const city = cities[index % cities.length];
      const firstName = customerFirstNames[index % customerFirstNames.length];
      const lastName = customerLastNames[index % customerLastNames.length];
      return new Customer({
        name: `${firstName} ${lastName} ${number(index + 1)}`,
        phone: `+91-00000-${String(30001 + index).slice(-5)}`,
        email: `customer${number(index + 1)}@customers.${SEED_EMAIL_DOMAIN}`,
        address: {
          street: `${10 + index} Sample Lane`,
          city: city[0],
          state: city[1],
          pincode: String(410000 + index * 97),
          country: "India",
        },
        notes: `${SEED_MARKER}: fictional customer record`,
        isActive: true,
        createdBy: users[(index % (users.length - 1)) + 1]._id,
      });
    },
  );

  return Customer.insertMany(customers, { session });
};

const selectProductLines = (products, stockById, transactionIndex) => {
  const selected = [];
  const seen = new Set();
  let cursor = 2 + ((transactionIndex * 7) % 98);

  while (selected.length < 3) {
    const product = products[cursor];
    cursor = 2 + ((cursor - 1) % 98);
    const id = product._id.toString();
    if (seen.has(id) || stockById.get(id) < 1) continue;
    seen.add(id);
    selected.push(product);
  }

  return selected;
};

const createPurchaseEvent = ({
  products,
  suppliers,
  users,
  stockById,
  costById,
  purchaseIndex,
  date,
}) => {
  const supplier = suppliers[purchaseIndex % suppliers.length];
  const selected = [0, 1, 2].map(
    (offset) => products[2 + ((purchaseIndex * 11 + offset * 29) % 98)],
  );
  const lines = selected.map((product) => {
    const id = product._id.toString();
    const quantity = random.integer(5, 12);
    const unitCost = roundMoney(
      costById.get(id) * (0.96 + random.integer(0, 8) / 100),
    );
    const base = roundMoney(unitCost * quantity);
    const gstRate = product.gstRate;
    const lineGst = roundMoney((base * gstRate) / 100);
    return {
      product,
      quantity,
      unitCost,
      gstRate,
      lineTotal: roundMoney(base + lineGst),
    };
  });
  const subtotal = roundMoney(
    lines.reduce((sum, line) => sum + line.unitCost * line.quantity, 0),
  );
  const discount = 0;
  let allocatedDiscount = 0;
  let totalGst = 0;
  const purchaseLines = lines.map((line, index) => {
    const base = roundMoney(line.unitCost * line.quantity);
    const lineDiscount =
      index === lines.length - 1
        ? roundMoney(discount - allocatedDiscount)
        : subtotal > 0
          ? roundMoney((discount * base) / subtotal)
          : 0;
    allocatedDiscount = roundMoney(allocatedDiscount + lineDiscount);
    const lineGst = roundMoney(((base - lineDiscount) * line.gstRate) / 100);
    totalGst = roundMoney(totalGst + lineGst);
    return {
      productId: line.product._id,
      name: line.product.name,
      sku: line.product.sku,
      quantity: line.quantity,
      receivedQuantity: line.quantity,
      unitCost: line.unitCost,
      gstRate: line.gstRate,
      lineDiscount,
      lineTotal: roundMoney(base - lineDiscount + lineGst),
    };
  });
  const totalAmount = roundMoney(subtotal - discount + totalGst);
  const statusGroup = purchaseIndex % 4;
  const paidAmount =
    statusGroup === 2
      ? 0
      : statusGroup === 1
        ? roundMoney(totalAmount * 0.45)
        : totalAmount;
  const method = paymentMethods[purchaseIndex % paymentMethods.length];
  const payments = createPayments({
    amount: paidAmount,
    method,
    split: paidAmount === totalAmount && purchaseIndex % 3 === 0,
  });
  const balanceDue = roundMoney(totalAmount - paidAmount);
  const purchaseNumber = `PO-SEED-${number(purchaseIndex + 1)}`;
  const purchase = new Purchase({
    purchaseNumber,
    idempotencyKey: `seed-purchase:${purchaseNumber}`,
    supplierId: supplier._id,
    products: purchaseLines,
    subtotal,
    totalGst,
    discount,
    totalAmount,
    paidAmount,
    balanceDue,
    paymentStatus:
      balanceDue === 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
    status: "received",
    payments,
    notes: `${SEED_MARKER}: inventory receipt`,
    createdBy: users[0]._id,
    receivedAt: date,
    createdAt: date,
    updatedAt: date,
  });

  const movements = [];
  for (const line of purchaseLines) {
    const productId = line.productId.toString();
    const previousStock = stockById.get(productId);
    const previousCost = costById.get(productId);
    const nextStock = previousStock + line.quantity;
    const nextCost = roundMoney(
      (previousStock * previousCost + line.quantity * line.unitCost) /
        nextStock,
    );
    stockById.set(productId, nextStock);
    costById.set(productId, nextCost);
    movements.push(
      new StockMovement({
        movementKey: `seed:purchase:${purchaseNumber}:${line.sku}`,
        productId: line.productId,
        movementType: "purchase",
        reason: `Stock received on ${purchaseNumber}`,
        quantityChange: line.quantity,
        balanceAfter: nextStock,
        unitCost: line.unitCost,
        sourceType: "purchase",
        sourceId: purchase._id,
        createdBy: users[0]._id,
        createdAt: date,
        updatedAt: date,
      }),
    );
  }

  const ledger = makeLedgerEntries(
    {
      sourceType: "purchase",
      sourceId: purchase._id,
      reference: purchaseNumber,
      transactionType: "purchase",
      createdBy: users[0]._id,
      partyType: "supplier",
      partyId: supplier._id,
      description: `Inventory received from supplier ${purchaseNumber}`,
      debits: [
        { account: "Inventory", amount: roundMoney(subtotal - discount) },
        { account: "GST input credit", amount: totalGst },
      ],
      credits: [{ account: "Accounts payable", amount: totalAmount }],
    },
    date,
  );
  if (payments.length) {
    ledger.push(
      ...makeLedgerEntries(
        {
          sourceType: "purchase",
          sourceId: purchase._id,
          reference: purchaseNumber,
          transactionType: "payment",
          createdBy: users[0]._id,
          partyType: "supplier",
          partyId: supplier._id,
          description: `Supplier payment for ${purchaseNumber}`,
          debits: payments.map((payment) => ({
            account: "Accounts payable",
            amount: payment.amount,
          })),
          credits: payments.map((payment) => ({
            account: paymentAccount[payment.method],
            amount: payment.amount,
            paymentMethod: payment.method,
          })),
        },
        date,
      ),
    );
  }

  const paymentDocuments = makePaymentDocuments({
    rows: payments,
    relatedType: "purchase",
    relatedId: purchase._id,
    purpose: "purchase",
    direction: "out",
    partyType: "supplier",
    partyId: supplier._id,
    createdBy: users[0]._id,
    date,
    prefix: `PUR-${number(purchaseIndex + 1)}`,
  });

  return { purchase, movements, ledger, paymentDocuments };
};

const createBillEvent = ({
  products,
  customers,
  users,
  stockById,
  costById,
  billIndex,
  date,
}) => {
  const selectedProducts = selectProductLines(products, stockById, billIndex);
  const customer = customers[billIndex % customers.length];
  const staff = users[(billIndex % EXPECTED_COUNTS.staff) + 1];
  const lineItems = selectedProducts.map((product) => {
    const available = stockById.get(product._id.toString());
    return {
      product,
      quantity: random.integer(1, Math.min(2, available)),
    };
  });
  const subtotal = roundMoney(
    lineItems.reduce(
      (sum, line) => sum + line.product.price * line.quantity,
      0,
    ),
  );
  const discount = billIndex % 9 === 0 ? roundMoney(subtotal * 0.04) : 0;
  let allocatedDiscount = 0;
  let totalGst = 0;
  const billLines = lineItems.map((line, index) => {
    const base = roundMoney(line.product.price * line.quantity);
    const lineDiscount =
      index === lineItems.length - 1
        ? roundMoney(discount - allocatedDiscount)
        : subtotal > 0
          ? roundMoney((discount * base) / subtotal)
          : 0;
    allocatedDiscount = roundMoney(allocatedDiscount + lineDiscount);
    const lineGst = roundMoney(
      ((base - lineDiscount) * line.product.gstRate) / 100,
    );
    totalGst = roundMoney(totalGst + lineGst);
    return {
      productId: line.product._id,
      name: line.product.name,
      quantity: line.quantity,
      price: line.product.price,
      gstRate: line.product.gstRate,
      lineDiscount,
      total: roundMoney(base - lineDiscount + lineGst),
    };
  });
  const totalAmount = roundMoney(subtotal - discount + totalGst);
  const paymentStatusGroup = billIndex % 10;
  const paidAmount =
    paymentStatusGroup === 0
      ? roundMoney(totalAmount * 0.6)
      : paymentStatusGroup === 1
        ? 0
        : totalAmount;
  const method = paymentMethods[billIndex % paymentMethods.length];
  const payments = createPayments({
    amount: paidAmount,
    method,
    split: paidAmount === totalAmount && billIndex % 8 === 0,
  });
  const balanceDue = roundMoney(totalAmount - paidAmount);
  const billNumber = `SP-SEED-${date.toISOString().slice(0, 10).replaceAll("-", "")}-${number(billIndex + 1)}`;
  const bill = new Bill({
    billNumber,
    idempotencyKey: `seed-bill:${billNumber}`,
    createdBy: staff._id,
    products: billLines,
    subtotal,
    totalGst,
    discount,
    totalAmount,
    paymentMethod: payments.length === 1 ? payments[0].method : undefined,
    payments,
    paidAmount,
    amountTendered: paidAmount,
    changeDue: 0,
    balanceDue,
    paymentStatus:
      balanceDue === 0 ? "paid" : paidAmount > 0 ? "partial" : "unpaid",
    customerId: customer._id,
    customerName: customer.name,
    customerContact: customer.phone,
    isReturn: false,
    originalBillId: null,
    createdAt: date,
    updatedAt: date,
  });

  const movements = billLines.map((line) => {
    const productId = line.productId.toString();
    const nextStock = stockById.get(productId) - line.quantity;
    stockById.set(productId, nextStock);
    return new StockMovement({
      movementKey: `seed:bill:${billNumber}:${line.productId}`,
      productId: line.productId,
      movementType: "sale",
      reason: `Stock sold on ${billNumber}`,
      quantityChange: -line.quantity,
      balanceAfter: nextStock,
      unitCost: costById.get(productId),
      sourceType: "bill",
      sourceId: bill._id,
      createdBy: staff._id,
      createdAt: date,
      updatedAt: date,
    });
  });

  const ledger = makeLedgerEntries(
    {
      sourceType: "bill",
      sourceId: bill._id,
      reference: billNumber,
      transactionType: "sale",
      createdBy: staff._id,
      partyType: "customer",
      partyId: customer._id,
      description: `Sale ${billNumber}`,
      debits: [
        ...payments.map((payment) => ({
          account: paymentAccount[payment.method],
          amount: payment.amount,
          paymentMethod: payment.method,
        })),
        ...(balanceDue > 0
          ? [{ account: "Accounts receivable", amount: balanceDue }]
          : []),
      ],
      credits: [
        { account: "Sales revenue", amount: roundMoney(subtotal - discount) },
        { account: "GST payable", amount: totalGst },
      ],
    },
    date,
  );

  const paymentDocuments = makePaymentDocuments({
    rows: payments,
    relatedType: "bill",
    relatedId: bill._id,
    purpose: "sale",
    direction: "in",
    partyType: "customer",
    partyId: customer._id,
    createdBy: staff._id,
    date,
    prefix: `BILL-${number(billIndex + 1)}`,
  });

  return { bill, movements, ledger, paymentDocuments };
};

const createSeedExpenseEvents = (users) => {
  const categories = [
    "Rent",
    "Utilities",
    "Internet",
    "Transport",
    "Maintenance",
    "Packaging",
  ];
  const descriptions = [
    "Monthly shop rent",
    "Electricity and water bill",
    "Business broadband service",
    "Local stock transportation",
    "Store equipment maintenance",
    "Packing material replenishment",
  ];
  const expenses = [];
  const payments = [];
  const ledger = [];

  for (let index = 0; index < EXPECTED_COUNTS.expenses; index += 1) {
    const date = dateAt(29 - index, 19, 15);
    const category = categories[index % categories.length];
    const description = descriptions[index % descriptions.length];
    const amount =
      category === "Rent"
        ? random.integer(18_000, 32_000)
        : random.integer(450, 8_500);
    const method = paymentMethods[(index + 2) % paymentMethods.length];
    const expenseNumber = `EXP-SEED-${number(index + 1)}`;
    const expense = new Expense({
      expenseNumber,
      idempotencyKey: `seed-expense:${expenseNumber}`,
      category,
      description: `${description} (${SEED_MARKER})`,
      amount,
      date,
      paymentMethod: method,
      reference: `DEMO-EXP-${number(index + 1)}`,
      createdBy: users[index % users.length]._id,
      createdAt: date,
      updatedAt: date,
    });
    expenses.push(expense);
    payments.push(
      ...makePaymentDocuments({
        rows: [{ method, amount }],
        relatedType: "expense",
        relatedId: expense._id,
        purpose: "expense",
        direction: "out",
        partyType: "other",
        partyId: undefined,
        createdBy: expense.createdBy,
        date,
        prefix: `EXP-${number(index + 1)}`,
      }),
    );
    ledger.push(
      ...makeLedgerEntries(
        {
          sourceType: "expense",
          sourceId: expense._id,
          reference: expenseNumber,
          transactionType: "expense",
          createdBy: expense.createdBy,
          description: expense.description,
          debits: [{ account: `Expense: ${category}`, amount }],
          credits: [
            {
              account: paymentAccount[method],
              amount,
              paymentMethod: method,
            },
          ],
        },
        date,
      ),
    );
  }

  return { expenses, payments, ledger };
};

const createOpeningMovements = (products, users, stockById, costById) =>
  products.map((product) => {
    const initialQuantity = product.stockQuantity;
    const movement = new StockMovement({
      movementKey: `seed:opening:${product.sku}`,
      productId: product._id,
      movementType: "adjustment",
      reason: `${SEED_MARKER}: opening inventory`,
      quantityChange: initialQuantity,
      balanceAfter: initialQuantity,
      unitCost: product.costPrice,
      sourceType: "adjustment",
      createdBy: users[0]._id,
      createdAt: dateAt(30, 6),
      updatedAt: dateAt(30, 6),
    });
    movement.sourceId = movement._id;
    stockById.set(product._id.toString(), initialQuantity);
    costById.set(product._id.toString(), product.costPrice);
    return movement;
  });

const createTransactionEvents = ({ products, suppliers, customers, users }) => {
  const stockById = new Map();
  const costById = new Map();
  const openingMovements = createOpeningMovements(
    products,
    users,
    stockById,
    costById,
  );
  const events = [];

  for (let index = 0; index < EXPECTED_COUNTS.purchases; index += 1) {
    events.push({
      type: "purchase",
      index,
      date: dateAt(29 - index, 8, 30),
    });
  }
  for (let index = 0; index < EXPECTED_COUNTS.bills; index += 1) {
    const dayOffset = Math.floor(index / 5);
    const billOfDay = index % 5;
    events.push({
      type: "bill",
      index,
      date: dateAt(29 - dayOffset, 10 + billOfDay * 2, 10 + (index % 4) * 10),
    });
  }
  events.sort((a, b) => a.date - b.date);

  const purchases = [];
  const bills = [];
  const movements = [...openingMovements];
  const ledger = [];
  const payments = [];

  for (const event of events) {
    if (event.type === "purchase") {
      const result = createPurchaseEvent({
        products,
        suppliers,
        users,
        stockById,
        costById,
        purchaseIndex: event.index,
        date: event.date,
      });
      purchases.push(result.purchase);
      movements.push(...result.movements);
      ledger.push(...result.ledger);
      payments.push(...result.paymentDocuments);
    } else {
      const result = createBillEvent({
        products,
        customers,
        users,
        stockById,
        costById,
        billIndex: event.index,
        date: event.date,
      });
      bills.push(result.bill);
      movements.push(...result.movements);
      ledger.push(...result.ledger);
      payments.push(...result.paymentDocuments);
    }
  }

  for (const product of products) {
    const id = product._id.toString();
    product.stockQuantity = stockById.get(id);
    product.costPrice = costById.get(id);
  }

  return { products, purchases, bills, movements, ledger, payments };
};

const validateSeedPlan = ({
  users,
  categories,
  suppliers,
  products,
  customers,
  purchases,
  bills,
  expenses,
  payments,
  ledger,
  movements,
}) => {
  const skus = products.map((product) => product.sku);
  const billNumbers = bills.map((bill) => bill.billNumber);
  if (new Set(skus).size !== skus.length)
    throw new Error("Seed plan contains duplicate product SKUs.");
  if (new Set(billNumbers).size !== billNumbers.length)
    throw new Error("Seed plan contains duplicate bill numbers.");
  if (
    products.some(
      (product) =>
        !categories.some((category) => category.name === product.category) ||
        !suppliers.some((supplier) => supplier._id.equals(product.supplierId)),
    )
  ) {
    throw new Error("A seeded product has an invalid category or supplier.");
  }

  const validProductIds = new Set(products.map((product) => product.id));
  const validUserIds = new Set(users.map((user) => user.id));
  const transactionIdsByType = {
    bill: new Set(bills.map((bill) => bill.id)),
    purchase: new Set(purchases.map((purchase) => purchase.id)),
    expense: new Set(expenses.map((expense) => expense.id)),
  };
  if (
    purchases.some(
      (purchase) =>
        !suppliers.some((supplier) =>
          supplier._id.equals(purchase.supplierId),
        ) ||
        purchase.products.some(
          (line) => !validProductIds.has(line.productId.toString()),
        ),
    ) ||
    bills.some(
      (bill) =>
        !users.some((user) => user._id.equals(bill.createdBy)) ||
        bill.products.some(
          (line) => !validProductIds.has(line.productId.toString()),
        ) ||
        !customers.some((customer) => customer._id.equals(bill.customerId)),
    )
  ) {
    throw new Error("A seeded transaction contains an invalid reference.");
  }

  for (const payment of payments) {
    if (
      !validUserIds.has(payment.createdBy.toString()) ||
      !transactionIdsByType[payment.relatedType]?.has(
        payment.relatedId.toString(),
      )
    ) {
      throw new Error(
        "A seeded payment has an invalid transaction or user reference.",
      );
    }
  }
  for (const entry of ledger) {
    if (
      !validUserIds.has(entry.createdBy.toString()) ||
      !transactionIdsByType[entry.sourceType]?.has(entry.sourceId.toString())
    ) {
      throw new Error(
        "A seeded ledger entry has an invalid source or user reference.",
      );
    }
  }
  for (const movement of movements) {
    const sourceExists =
      movement.sourceType === "adjustment"
        ? movement.sourceId.equals(movement._id)
        : movement.sourceType === "bill"
          ? transactionIdsByType.bill.has(movement.sourceId.toString())
          : movement.sourceType === "purchase"
            ? transactionIdsByType.purchase.has(movement.sourceId.toString())
            : false;
    if (
      !validProductIds.has(movement.productId.toString()) ||
      !validUserIds.has(movement.createdBy.toString()) ||
      !sourceExists
    ) {
      throw new Error("A seeded stock movement has an invalid reference.");
    }
  }

  const movementTotals = new Map();
  for (const movement of movements) {
    const productId = movement.productId.toString();
    movementTotals.set(
      productId,
      (movementTotals.get(productId) || 0) + movement.quantityChange,
    );
  }
  for (const product of products) {
    if (movementTotals.get(product.id) !== product.stockQuantity) {
      throw new Error(`Stock movements do not reconcile for ${product.sku}.`);
    }
  }

  const debitTotal = roundMoney(
    ledger.reduce((total, entry) => total + entry.debit, 0),
  );
  const creditTotal = roundMoney(
    ledger.reduce((total, entry) => total + entry.credit, 0),
  );
  if (debitTotal !== creditTotal) {
    throw new Error(
      `Ledger does not balance (debits ${debitTotal}, credits ${creditTotal}).`,
    );
  }
  const ledgerBySource = new Map();
  for (const entry of ledger) {
    const key = `${entry.sourceType}:${entry.sourceId}:${entry.transactionType}`;
    const totals = ledgerBySource.get(key) || { debit: 0, credit: 0 };
    totals.debit = roundMoney(totals.debit + entry.debit);
    totals.credit = roundMoney(totals.credit + entry.credit);
    ledgerBySource.set(key, totals);
  }
  for (const [source, totals] of ledgerBySource) {
    if (totals.debit !== totals.credit) {
      throw new Error(`Ledger entries do not balance for ${source}.`);
    }
  }

  const paymentTotals = new Map();
  for (const payment of payments) {
    const key = `${payment.relatedType}:${payment.relatedId}`;
    paymentTotals.set(
      key,
      roundMoney((paymentTotals.get(key) || 0) + payment.amount),
    );
  }
  for (const transaction of [...bills, ...purchases]) {
    const key = `${transaction instanceof Bill ? "bill" : "purchase"}:${transaction._id}`;
    if ((paymentTotals.get(key) || 0) !== transaction.paidAmount) {
      throw new Error(
        `Payment total does not reconcile for ${transaction.billNumber || transaction.purchaseNumber}.`,
      );
    }
  }
  for (const expense of expenses) {
    if (paymentTotals.get(`expense:${expense._id}`) !== expense.amount) {
      throw new Error(
        `Expense payment does not reconcile for ${expense.expenseNumber}.`,
      );
    }
  }

  return {
    admins: users.filter((user) => user.role === "admin").length,
    staff: users.filter((user) => user.role === "staff").length,
    categories: categories.length,
    suppliers: suppliers.length,
    products: products.length,
    customers: customers.length,
    purchases: purchases.length,
    bills: bills.length,
    payments: payments.length,
    expenses: expenses.length,
    ledgerEntries: ledger.length,
    stockMovements: movements.length,
  };
};

const persistSeedPlan = async (plan, session) => {
  const options = { session, ordered: true };
  for (const product of plan.products) {
    await product.save({ session });
  }
  await Purchase.insertMany(plan.purchases, options);
  await Bill.insertMany(plan.bills, options);
  await Expense.insertMany(plan.expenses, options);
  await Payment.insertMany(plan.payments, options);
  await LedgerEntry.insertMany(plan.ledger, options);
  await StockMovement.insertMany(plan.movements, options);
};

const validatePersistedSeed = async (plan, credentials, session) => {
  const countForIds = async (Model, documents) =>
    Model.countDocuments({
      _id: { $in: documents.map((document) => document._id) },
    }).session(session);

  const persistedCounts = {
    users: await countForIds(User, plan.users),
    categories: await Category.countDocuments({
      name: { $in: categoryCatalog.map((category) => category.name) },
    }).session(session),
    suppliers: await countForIds(Supplier, plan.suppliers),
    products: await countForIds(Product, plan.products),
    customers: await countForIds(Customer, plan.customers),
    purchases: await countForIds(Purchase, plan.purchases),
    bills: await countForIds(Bill, plan.bills),
    expenses: await countForIds(Expense, plan.expenses),
    payments: await countForIds(Payment, plan.payments),
    ledgerEntries: await countForIds(LedgerEntry, plan.ledger),
    stockMovements: await countForIds(StockMovement, plan.movements),
  };

  const expectedCounts = {
    users: plan.users.length,
    categories: EXPECTED_COUNTS.categories,
    suppliers: plan.suppliers.length,
    products: plan.products.length,
    customers: plan.customers.length,
    purchases: plan.purchases.length,
    bills: plan.bills.length,
    expenses: plan.expenses.length,
    payments: plan.payments.length,
    ledgerEntries: plan.ledger.length,
    stockMovements: plan.movements.length,
  };
  for (const [collection, expected] of Object.entries(expectedCounts)) {
    if (persistedCounts[collection] !== expected) {
      throw new Error(
        `Database validation failed for ${collection}: expected ${expected}, found ${persistedCounts[collection]}.`,
      );
    }
  }

  const [duplicateSku, duplicateBillNumber, stockTotals, ledgerTotals] = [
    await Product.aggregate([
      { $match: { sku: { $regex: seededProductPattern } } },
      { $group: { _id: "$sku", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]).session(session),
    await Bill.aggregate([
      { $match: { billNumber: { $regex: seededBillPattern } } },
      { $group: { _id: "$billNumber", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]).session(session),
    await StockMovement.aggregate([
      { $match: { productId: { $in: plan.products.map((item) => item._id) } } },
      {
        $group: {
          _id: "$productId",
          quantityChange: { $sum: "$quantityChange" },
        },
      },
    ]).session(session),
    await LedgerEntry.aggregate([
      {
        $match: {
          _id: { $in: plan.ledger.map((entry) => entry._id) },
        },
      },
      {
        $group: {
          _id: null,
          debit: { $sum: "$debit" },
          credit: { $sum: "$credit" },
        },
      },
    ]).session(session),
  ];

  if (duplicateSku.length || duplicateBillNumber.length) {
    throw new Error("Database validation found duplicate seed identifiers.");
  }

  const movementTotals = new Map(
    stockTotals.map((item) => [item._id.toString(), item.quantityChange]),
  );
  const persistedProducts = await Product.find(
    { _id: { $in: plan.products.map((product) => product._id) } },
    "sku stockQuantity supplierId category",
    { session },
  );
  for (const product of persistedProducts) {
    if (movementTotals.get(product.id) !== product.stockQuantity) {
      throw new Error(`Persisted stock does not reconcile for ${product.sku}.`);
    }
    if (
      !plan.suppliers.some((supplier) =>
        supplier._id.equals(product.supplierId),
      )
    ) {
      throw new Error(
        `Persisted supplier reference is invalid for ${product.sku}.`,
      );
    }
    if (
      !categoryCatalog.some((category) => category.name === product.category)
    ) {
      throw new Error(`Persisted category is invalid for ${product.sku}.`);
    }
  }

  const totals = ledgerTotals[0] || { debit: 0, credit: 0 };
  if (roundMoney(totals.debit) !== roundMoney(totals.credit)) {
    throw new Error("Persisted ledger debits and credits do not balance.");
  }

  const billDates = new Set(
    plan.bills.map((bill) => bill.createdAt.toDateString()),
  );
  if (billDates.size < 20) {
    throw new Error(
      "Seed sales are not distributed across enough report dates.",
    );
  }

  const admin = plan.users.find((user) => user.role === "admin");
  const staff = plan.users.find((user) => user.role === "staff");
  if (
    !admin?.isActive ||
    !staff?.isActive ||
    !(await bcrypt.compare(credentials.admin.password, admin.password)) ||
    !(await bcrypt.compare(credentials.staffPassword, staff.password))
  ) {
    throw new Error("Seed account password validation failed.");
  }
};

const createSeedPlan = async (session, credentials) => {
  const users = await createSeedUsers(session, credentials);
  const categories = await createSeedCategories(session, users[0]._id);
  const suppliers = await createSeedSuppliers(session);
  const products = await createSeedProducts(session, users, suppliers);
  const customers = await createSeedCustomers(session, users);
  const transactionData = createTransactionEvents({
    products,
    suppliers,
    customers,
    users,
  });
  const expenseData = createSeedExpenseEvents(users);
  const plan = {
    users,
    categories,
    suppliers,
    products: transactionData.products,
    customers,
    purchases: transactionData.purchases,
    bills: transactionData.bills,
    expenses: expenseData.expenses,
    payments: [...transactionData.payments, ...expenseData.payments],
    ledger: [...transactionData.ledger, ...expenseData.ledger],
    movements: transactionData.movements,
  };

  const counts = validateSeedPlan(plan);
  await persistSeedPlan(plan, session);
  await validatePersistedSeed(plan, credentials, session);
  return { plan, counts };
};

const printCredentials = (credentials) => {
  console.log("\nDevelopment login credentials");
  console.log(
    `  Admin: ${credentials.admin.email} / ${credentials.admin.password}`,
  );
  console.log(
    `  Staff emails: ${Array.from(
      { length: EXPECTED_COUNTS.staff },
      (_, index) => `staff${number(index + 1)}@${SEED_EMAIL_DOMAIN}`,
    ).join(", ")}`,
  );
  console.log(`  Shared staff password: ${credentials.staffPassword}`);
};

const runSeed = async () => {
  assertDevelopmentEnvironment();
  const credentials = getCredentials();
  await connectDB();

  const session = await mongoose.startSession();
  try {
    let summary;
    let wasAlreadySeeded = false;

    await session.withTransaction(async () => {
      const existing = await getExistingSeedData(session);
      if (resetRequested) {
        await assertResetIsSafe(existing, session);
        await clearSeedRecords(existing, session);
      } else if (hasSeedRecords(existing)) {
        const categoryCount = await Category.countDocuments({
          name: { $in: categoryCatalog.map((category) => category.name) },
        }).session(session);
        const transactionIds = [
          ...existing.bills.map((item) => item._id),
          ...existing.purchases.map((item) => item._id),
          ...existing.expenses.map((item) => item._id),
        ];
        const paymentCount = await Payment.countDocuments({
          $or: [
            { relatedId: { $in: transactionIds } },
            { paymentNumber: { $regex: /^PAY-SEED-/ } },
          ],
        }).session(session);
        const ledgerCount = await LedgerEntry.countDocuments({
          sourceId: { $in: transactionIds },
        }).session(session);
        const movementCount = await StockMovement.countDocuments({
          $or: [
            {
              sourceId: {
                $in: [...existing.bills, ...existing.purchases].map(
                  (item) => item._id,
                ),
              },
            },
            { movementKey: { $regex: /^seed:/ } },
          ],
        }).session(session);

        if (
          !isCompleteSeed(existing) ||
          categoryCount !== EXPECTED_COUNTS.categories ||
          paymentCount === 0 ||
          ledgerCount === 0 ||
          movementCount === 0
        ) {
          throw new Error(
            "A partial StockPilot seed dataset already exists. Run `npm run seed:reset` in development to rebuild only marked seed data.",
          );
        }
        wasAlreadySeeded = true;
        summary = {
          admins: 1,
          staff: EXPECTED_COUNTS.staff,
          categories: categoryCatalog.length,
          suppliers: existing.suppliers.length,
          products: existing.products.length,
          customers: existing.customers.length,
          purchases: existing.purchases.length,
          bills: existing.bills.length,
          payments: paymentCount,
          expenses: existing.expenses.length,
          ledgerEntries: ledgerCount,
          stockMovements: movementCount,
        };
      }

      if (!wasAlreadySeeded) {
        const { counts } = await createSeedPlan(session, credentials);
        summary = counts;
      }
    });

    console.log(
      wasAlreadySeeded
        ? "StockPilot development seed already exists; no records were changed."
        : resetRequested
          ? "StockPilot development seed was safely reset and rebuilt."
          : "StockPilot development data seeded successfully.",
    );
    console.log("\nRecord counts\n" + summarizeCounts(summary));
    console.log("Skipped or failed records: none.");
    if (wasAlreadySeeded) {
      console.log(
        "\nExisting seed credentials were retained. Set SEED_* credentials before the first seed to choose login details.",
      );
    } else {
      printCredentials(credentials);
    }
    console.log(
      "\nValidation: references, payment totals, stock movements, and ledger debits/credits reconciled.",
    );
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
};

runSeed().catch((error) => {
  console.error("StockPilot database seeding failed:", error.message);
  mongoose.disconnect().finally(() => {
    process.exitCode = 1;
  });
});
