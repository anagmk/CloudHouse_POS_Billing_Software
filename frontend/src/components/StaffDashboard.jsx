import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import SidebarIcon from "./SidebarIcon";
import StaffPortalPages from "./StaffPortalPages";
import { API_BASE_URL } from "../utils/api";

const serverUrl = API_BASE_URL;

const mapProduct = (product) => ({
  id: product._id,
  sku: product.sku,
  name: product.name,
  category: product.category,
  price: product.price,
  stock: product.stockQuantity,
  gstRate: product.gstRate,
  icon: product.name?.trim()?.[0]?.toUpperCase() || "P",
});

const mapBill = (bill) => ({
  id: bill._id,
  billNumber: bill.billNumber || bill._id,
  date: bill.createdAt,
  staffName: bill.createdBy?.username || "Staff",
  customerName: bill.customerName || "Walk-in Customer",
  customerPhone: bill.customerContact || "",
  paymentMethod:
    bill.paymentMethod ||
    (bill.payments?.length > 1
      ? "split"
      : bill.payments?.[0]?.method || bill.paymentStatus || "unpaid"),
  payments: bill.payments || [],
  paymentStatus: bill.paymentStatus || "paid",
  paidAmount: bill.paidAmount || 0,
  amountTendered: bill.amountTendered ?? bill.paidAmount ?? 0,
  changeDue: bill.changeDue || 0,
  balanceDue: bill.balanceDue || 0,
  items: (bill.products || []).map((item) => ({
    id: item.productId,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    gstRate: item.gstRate,
    discount: item.lineDiscount || 0,
    total: item.total,
  })),
  subtotal: bill.subtotal,
  tax: bill.totalGst,
  discount: bill.discount || 0,
  total: bill.totalAmount,
  isReturn: Boolean(bill.isReturn),
  isCancelled: Boolean(bill.isCancelled),
  originalBillId: bill.originalBillId?.toString() || null,
});

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

export default function StaffDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const path = location.pathname.replace(/\/$/, "");
  const page =
    path === "/staff/transactions"
      ? "Transactions"
      : path === "/staff/products"
        ? "Products"
        : path === "/staff/customers"
          ? "Customers"
          : path === "/staff/profile"
            ? "Profile"
            : "Billing";
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitMethod, setSplitMethod] = useState("cash");
  const [splitAmount, setSplitAmount] = useState("");
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID());
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [registeringCustomer, setRegisteringCustomer] = useState(false);
  const [customerDraft, setCustomerDraft] = useState({
    name: "",
    phone: "",
    email: "",
  });
  const [paymentAmount, setPaymentAmount] = useState("");
  const [discount, setDiscount] = useState(0);
  const [completedBill, setCompletedBill] = useState(null);
  const [notice, setNotice] = useState(() =>
    localStorage.getItem("token") && serverUrl
      ? ""
      : "Your session or billing service is unavailable. Please sign in again.",
  );
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(() =>
    Boolean(localStorage.getItem("token") && serverUrl),
  );
  const [loadingHistory, setLoadingHistory] = useState(() =>
    Boolean(localStorage.getItem("token") && serverUrl),
  );

  const categories = useMemo(
    () => ["All", ...new Set(products.map((product) => product.category))],
    [products],
  );

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("token");

    if (!token || !serverUrl) {
      return () => {
        active = false;
      };
    }

    const load = async (path) => {
      const response = await fetch(`${serverUrl}/bills/${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "Could not load billing data");
      return data;
    };

    load("catalog")
      .then((data) => {
        if (active) setProducts((data.products || []).map(mapProduct));
      })
      .catch((error) => {
        if (active) setNotice(error.message);
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("token");
    if (!token || !serverUrl)
      return () => {
        active = false;
      };
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (customerSearch.trim()) params.set("search", customerSearch.trim());
        const response = await fetch(`${serverUrl}/customers?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && active)
          setCustomers((current) => {
            const merged = new Map(
              current.map((customer) => [customer._id, customer]),
            );
            (result.customers || []).forEach((customer) =>
              merged.set(customer._id, customer),
            );
            return [...merged.values()];
          });
      } catch {
        /* Customer search stays optional while billing. */
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerSearch]);

  const registerCustomer = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    setRegisteringCustomer(true);
    try {
      const response = await fetch(`${serverUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(customerDraft),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.message || "Could not register customer.");
      const customer = result.customer;
      setCustomers((current) => [
        customer,
        ...current.filter((item) => item._id !== customer._id),
      ]);
      setCustomerId(customer._id);
      setCustomerName(customer.name);
      setCustomerPhone(customer.phone || "");
      setCustomerDraft({ name: "", phone: "", email: "" });
      setShowCustomerForm(false);
      setNotice("Customer registered and selected.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setRegisteringCustomer(false);
    }
  };

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("token");
    if (!token || !serverUrl)
      return () => {
        active = false;
      };
    const timer = setTimeout(async () => {
      setLoadingHistory(true);
      try {
        const params = new URLSearchParams({
          limit: "50",
          page: String(historyPage),
        });
        if (historySearch.trim()) params.set("search", historySearch.trim());
        if (historyFrom) params.set("from", historyFrom);
        if (historyTo) params.set("to", historyTo);
        const response = await fetch(`${serverUrl}/bills/history?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            result.message || "Could not load transaction history.",
          );
        if (active) {
          setTransactions((result.bills || []).map(mapBill));
          setHistoryTotalPages(result.totalPages || 1);
        }
      } catch (error) {
        if (active) setNotice(error.message);
      } finally {
        if (active) setLoadingHistory(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [historyPage, historySearch, historyFrom, historyTo]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        category === "All" || product.category === category;

      const matchesSearch = `${product.name} ${product.sku} ${product.category}`
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const discountAmount = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const gstCalculation = cart.reduce(
    (result, item, index) => {
      const lineBase = item.price * item.quantity;
      const lineDiscount =
        index === cart.length - 1
          ? discountAmount - result.allocated
          : subtotal > 0
            ? Math.round(((discountAmount * lineBase) / subtotal) * 100) / 100
            : 0;
      return {
        allocated: result.allocated + lineDiscount,
        discounts: [...result.discounts, lineDiscount],
        tax:
          result.tax +
          Math.round((lineBase - lineDiscount) * item.gstRate) / 100,
      };
    },
    { allocated: 0, discounts: [], tax: 0 },
  );
  const totalGst = gstCalculation.tax;
  const total = subtotal - discountAmount + totalGst;
  const receivedPreview =
    paymentAmount === "" ? total : Math.max(0, Number(paymentAmount) || 0);
  const appliedPreview = Math.min(total, receivedPreview);
  const balancePreview = Math.max(0, total - appliedPreview);
  const changePreview =
    !splitPayment && paymentMethod === "cash"
      ? Math.max(0, receivedPreview - total)
      : 0;

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);

  const addToCart = (product) => {
    setNotice("");
    setCompletedBill(null);

    if (product.stock <= 0) {
      setNotice("This product is out of stock.");
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock) {
          setNotice("Available stock limit reached.");
          return current;
        }

        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (productId, change) => {
    setNotice("");
    setCompletedBill(null);

    setCart((current) =>
      current
        .map((item) => {
          if (item.id !== productId) return item;

          const product = products.find((p) => p.id === productId);
          if (!product) {
            setNotice(
              "This product is no longer available. Refresh the catalog.",
            );
            return item;
          }
          const quantity = item.quantity + change;

          if (quantity > product.stock) {
            setNotice("Available stock limit reached.");
            return item;
          }

          return {
            ...item,
            quantity,
          };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (productId) => {
    setCart((current) => current.filter((item) => item.id !== productId));
    setCompletedBill(null);
  };

  const checkout = async () => {
    if (processing) return;

    if (cart.length === 0) {
      setNotice("Add at least one product before checkout.");
      return;
    }

    if (
      cart.some((item) => {
        const product = products.find((p) => p.id === item.id);
        return !product || item.quantity > product.stock;
      })
    ) {
      setNotice("Stock has changed. Review the cart before checkout.");
      return;
    }

    setProcessing(true);
    setNotice("");

    try {
      const token = localStorage.getItem("token");
      const requestedTender =
        paymentAmount === "" ? total : Number(paymentAmount);
      const cashChange = !splitPayment && paymentMethod === "cash";
      if (
        !Number.isFinite(requestedTender) ||
        requestedTender < 0 ||
        (requestedTender > total && !cashChange)
      )
        throw new Error(
          "Amount received must be between zero and the bill total, except cash tender.",
        );
      const tendered = Math.min(requestedTender, total);
      const secondTender = splitPayment
        ? Math.max(0, Number(splitAmount) || 0)
        : 0;
      if (tendered < total && !customerId)
        throw new Error(
          "Select a customer before recording an outstanding balance.",
        );
      if (secondTender > tendered)
        throw new Error(
          "Split payment amount cannot exceed the amount tendered.",
        );
      const response = await fetch(`${serverUrl}/bills/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": checkoutKey,
        },
        body: JSON.stringify({
          products: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          payments: splitPayment
            ? [
                ...(tendered - secondTender > 0
                  ? [
                      {
                        method: paymentMethod,
                        amount:
                          Math.round((tendered - secondTender) * 100) / 100,
                      },
                    ]
                  : []),
                ...(secondTender > 0
                  ? [
                      {
                        method: splitMethod,
                        amount: Math.round(secondTender * 100) / 100,
                      },
                    ]
                  : []),
              ]
            : tendered > 0
              ? [
                  {
                    method: paymentMethod,
                    amount: Math.round(tendered * 100) / 100,
                  },
                ]
              : [],
          discount: discountAmount,
          amountTendered: requestedTender,
          customerId: customerId || undefined,
          customerName: customerName.trim(),
          customerContact: customerPhone.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "Could not complete the bill.");

      const bill = mapBill(data.bill);
      setTransactions((current) => [bill, ...current]);
      setCompletedBill(bill);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerId("");
      setPaymentAmount("");
      setCheckoutKey(crypto.randomUUID());
      setDiscount(0);
      setNotice("Bill completed successfully.");
      try {
        const catalogResponse = await fetch(`${serverUrl}/bills/catalog`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const catalogData = await catalogResponse.json().catch(() => ({}));
        if (catalogResponse.ok)
          setProducts((catalogData.products || []).map(mapProduct));
      } catch {
        // The bill is already saved; a later catalog refresh can pick up the new stock.
      }
    } catch (error) {
      setNotice(
        error.message || "Unable to complete the bill. Please try again.",
      );
      if (/stock|product.*active|unavailable/i.test(error.message || "")) {
        const response = await fetch(`${serverUrl}/bills/catalog`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }).catch(() => null);
        if (response?.ok) {
          const result = await response.json().catch(() => ({}));
          setProducts((result.products || []).map(mapProduct));
        }
      }
    } finally {
      setProcessing(false);
    }
  };

  const collectBillPayment = async (bill) => {
    const amount = Number(
      window.prompt(
        "Outstanding amount: " +
          money(bill.balanceDue) +
          ". Enter amount received:",
        String(bill.balanceDue),
      ),
    );
    if (!Number.isFinite(amount) || amount <= 0) return;
    const method = window
      .prompt("Payment method: cash, upi, card, bank, or other", "cash")
      ?.trim()
      .toLowerCase();
    if (!["cash", "upi", "card", "bank", "other"].includes(method)) {
      setNotice("Choose cash, upi, card, bank, or other.");
      return;
    }
    try {
      const response = await fetch(
        serverUrl + "/bills/" + bill.id + "/payments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + localStorage.getItem("token"),
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({ amount, method }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message || "Could not record payment.");
      setTransactions((current) =>
        current.map((item) =>
          item.id === bill.id ? mapBill(data.bill) : item,
        ),
      );
      setNotice("Customer payment recorded.");
    } catch (error) {
      setNotice(error.message);
    }
  };

  const printBill = () => {
    if (!completedBill) return;

    const bill = completedBill;
    const receiptWindow = window.open("", "_blank", "width=420,height=700");

    if (!receiptWindow) {
      setNotice("Allow pop-ups to print the receipt.");
      return;
    }

    const rows = bill.items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${item.quantity} × ${money(item.price)}</td>
            <td>${item.gstRate}%</td>
            <td>${money(item.discount)}</td>
            <td>${money(item.total)}</td>
          </tr>
        `,
      )
      .join("");
    const paymentRows = bill.payments
      .map(
        (payment) =>
          `<p class="right">${escapeHtml(String(payment.method || "Payment").toUpperCase())}: ${money(payment.amount)}</p>`,
      )
      .join("");

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt ${escapeHtml(bill.billNumber)}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 360px; margin: 24px auto; padding: 12px; color: #171717; }
            h1, p { text-align: center; }
            h1 { font-size: 22px; }
            p { font-size: 12px; }
            hr { border: 0; border-top: 1px dashed #999; margin: 16px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { padding: 8px 3px; border-bottom: 1px solid #eee; text-align: left; }
            .total { font-size: 18px; font-weight: bold; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>StockPilot</h1>
          <p>Sales Receipt</p>
          <hr>
          <p>Bill: ${escapeHtml(bill.billNumber)}</p>
          <p>${escapeHtml(new Date(bill.date).toLocaleString("en-IN"))}</p>
          <p>Staff: ${escapeHtml(bill.staffName)}</p>
          <p>Customer: ${escapeHtml(bill.customerName)}</p>
          <hr>
          <table>
            <thead>
              <tr><th>Product</th><th>Qty × Price</th><th>GST</th><th>Discount</th><th>Total</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <hr>
          <p class="right">Subtotal: ${money(bill.subtotal)}</p>
          <p class="right">GST: ${money(bill.tax)}</p>
          <p class="right">Discount: ${money(bill.discount)}</p>
          <p class="right total">Total: ${money(bill.total)}</p>
          ${paymentRows}
          <p class="right">Paid: ${money(bill.paidAmount)}</p>
          <p class="right">Balance: ${money(bill.balanceDue)}</p>
          ${bill.changeDue > 0 ? `<p class="right">Change: ${money(bill.changeDue)}</p>` : ""}
          <hr>
          <p>Thank you for shopping with us.</p>
          <script>window.onload = () => window.print();</scr${"ipt"}>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  const links = [
    ["Billing", "/staff/billing", "billing"],
    ["Transactions", "/staff/transactions", "transactions"],
    ["Products", "/staff/products", "products"],
    ["Customers", "/staff/customers", "customers"],
    ["Profile", "/staff/profile", "settings"],
  ];
  const sidebar = (
    <nav aria-label="Staff navigation" className="space-y-1">
      {links.map(([label, href, icon]) => (
        <NavLink
          key={href}
          to={href}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            `flex h-10 items-center gap-2.5 rounded px-2.5 text-sm ${isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"}`
          }
        >
          <SidebarIcon name={icon} className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
  if (path === "/staff") return <Navigate to="/staff/billing" replace />;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-50 text-slate-900">
      <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-5">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="rounded p-2 hover:bg-slate-100 lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link
            to="/staff/billing"
            className="text-base font-semibold tracking-tight"
          >
            StockPilot<span className="text-teal-700">.</span>
          </Link>
          <span className="hidden border-l border-slate-200 pl-4 text-sm text-slate-500 sm:block">
            Staff workspace
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium">Staff account</p>
            <p className="text-[11px] text-slate-500">Billing operator</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
            S
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/login", { replace: true });
            }}
            className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 lg:grid lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="hidden overflow-hidden border-r border-slate-200 bg-white p-3 lg:block">
          {sidebar}
        </aside>
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDrawerOpen(false);
            }}
          >
            <aside className="h-full w-72 max-w-[85vw] overflow-hidden bg-white p-3 shadow-xl">
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-sm font-semibold">Navigation</span>
                <button
                  aria-label="Close navigation"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded px-2 py-1 text-slate-500"
                >
                  Close
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
          <div className="mb-4">
            <h1 className="text-lg font-semibold tracking-tight">
              {page === "Billing" ? "New bill" : page}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {page === "Billing"
                ? "Create a sale and record payment."
                : page === "Transactions"
                  ? "Review bills created by your account."
                  : `View store ${page.toLowerCase()}.`}
            </p>
          </div>
          {page === "Billing" ? (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Create a sale and record payment.
                  </p>
                </div>
                <div className="flex items-center gap-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                  <span className="text-slate-500">Cart items</span>
                  <span className="font-semibold tabular-nums">
                    {cartCount}
                  </span>
                  <span className="h-4 border-l border-slate-200" />
                  <span className="text-slate-500">Total</span>
                  <span className="font-semibold tabular-nums">
                    {money(total)}
                  </span>
                </div>
              </div>

              {notice && (
                <div
                  role={notice.includes("successfully") ? "status" : "alert"}
                  className={`mb-4 rounded-md border px-3 py-2 text-sm ${notice.includes("successfully") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
                >
                  {notice}
                </div>
              )}

              <div className="mb-4 flex flex-wrap divide-x divide-slate-200 rounded-md border border-slate-200 bg-white text-xs">
                <div className="px-3 py-2">
                  <span className="text-slate-500">Products</span>
                  <span className="ml-2 font-semibold tabular-nums">
                    {products.length}
                  </span>
                </div>
                <div className="px-3 py-2">
                  <span className="text-slate-500">Items in cart</span>
                  <span className="ml-2 font-semibold tabular-nums">
                    {cartCount}
                  </span>
                </div>
                <div className="px-3 py-2">
                  <span className="text-slate-500">Recent bills</span>
                  <span className="ml-2 font-semibold tabular-nums">
                    {transactions.length}
                  </span>
                </div>
              </div>

              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_350px]">
                <section className="min-w-0 rounded-md border border-slate-200 bg-white">
                  <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-sm font-semibold">Products</h2>
                    <label className="flex h-9 items-center gap-2 rounded-md border border-slate-300 px-2.5 focus-within:border-teal-700 focus-within:ring-1 focus-within:ring-teal-700 sm:w-64">
                      <svg
                        className="h-4 w-4 shrink-0 text-slate-400"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden="true"
                      >
                        <circle cx="11" cy="11" r="7" />
                        <path d="m16 16 4 4" />
                      </svg>
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, SKU, category"
                        className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
                      />
                    </label>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 px-3 py-2">
                    {categories.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCategory(item)}
                        className={`shrink-0 rounded px-2.5 py-1.5 text-xs ${category === item ? "bg-teal-700 font-medium text-white" : "text-slate-600 hover:bg-slate-100"}`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                  {loadingProducts ? (
                    <p className="p-8 text-center text-sm text-slate-500">
                      Loading products…
                    </p>
                  ) : filteredProducts.length === 0 ? (
                    <p className="p-8 text-center text-sm text-slate-500">
                      No available products match this search.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 2xl:grid-cols-3">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          disabled={product.stock === 0}
                          onClick={() => addToCart(product)}
                          className="flex min-w-0 items-center gap-2.5 bg-white px-3 py-2.5 text-left hover:bg-slate-50 focus:z-10 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100 text-sm font-semibold text-slate-600">
                            {product.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-slate-900">
                              {product.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                              {product.sku} · {product.category}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-xs font-semibold tabular-nums">
                              {money(product.price)}
                            </span>
                            <span className="mt-0.5 block text-[10px] tabular-nums">
                              GST {product.gstRate}%
                            </span>
                            <span
                              className={`mt-0.5 block text-[10px] tabular-nums ${product.stock <= 5 ? "font-medium text-amber-700" : "text-slate-500"}`}
                            >
                              {product.stock === 0
                                ? "Out of stock"
                                : `${product.stock} in stock`}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-md border border-slate-200 bg-white xl:sticky xl:top-[4.5rem]">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
                    <h2 className="text-sm font-semibold">Current sale</h2>
                    <span className="text-xs tabular-nums text-slate-500">
                      {cartCount} items
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-b border-slate-200 p-3">
                    <input
                      aria-label="Search customers by name or phone"
                      value={customerSearch}
                      onChange={(event) =>
                        setCustomerSearch(event.target.value)
                      }
                      placeholder="Find customer by name or phone"
                      className="col-span-2 h-8 rounded border border-slate-300 px-2 text-xs outline-none focus:border-teal-700"
                    />
                    <select
                      aria-label="Customer"
                      value={customerId}
                      onChange={(event) => {
                        const customer = customers.find(
                          (item) => item._id === event.target.value,
                        );
                        setCustomerId(event.target.value);
                        setCustomerName(customer?.name || "");
                        setCustomerPhone(customer?.phone || "");
                      }}
                      className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2.5 text-xs"
                    >
                      <option value="">Walk-in customer</option>
                      {customers.map((customer) => (
                        <option key={customer._id} value={customer._id}>
                          {customer.name}
                          {customer.phone ? " · " + customer.phone : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCustomerForm((open) => !open)}
                      className="h-9 rounded border border-slate-300 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {showCustomerForm ? "Close" : "Register customer"}
                    </button>
                    <input
                      aria-label="Customer name"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Customer name"
                      maxLength={100}
                      className="h-9 min-w-0 rounded-md border border-slate-300 px-2.5 text-xs outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                    <input
                      aria-label="Customer phone"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Phone"
                      type="tel"
                      maxLength={20}
                      className="h-9 min-w-0 rounded-md border border-slate-300 px-2.5 text-xs outline-none placeholder:text-slate-400 focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                    {showCustomerForm && (
                      <form
                        onSubmit={registerCustomer}
                        className="col-span-2 grid grid-cols-2 gap-2 rounded border border-slate-200 bg-slate-50 p-2"
                      >
                        <input
                          required
                          aria-label="New customer name"
                          value={customerDraft.name}
                          onChange={(event) =>
                            setCustomerDraft({
                              ...customerDraft,
                              name: event.target.value,
                            })
                          }
                          placeholder="Name"
                          className="h-8 rounded border border-slate-300 px-2 text-xs"
                        />
                        <input
                          aria-label="New customer phone"
                          value={customerDraft.phone}
                          onChange={(event) =>
                            setCustomerDraft({
                              ...customerDraft,
                              phone: event.target.value,
                            })
                          }
                          placeholder="Phone"
                          className="h-8 rounded border border-slate-300 px-2 text-xs"
                        />
                        <input
                          aria-label="New customer email"
                          type="email"
                          value={customerDraft.email}
                          onChange={(event) =>
                            setCustomerDraft({
                              ...customerDraft,
                              email: event.target.value,
                            })
                          }
                          placeholder="Email (optional)"
                          className="h-8 rounded border border-slate-300 px-2 text-xs"
                        />
                        <button
                          disabled={registeringCustomer}
                          className="h-8 rounded bg-teal-700 px-2 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {registeringCustomer ? "Saving…" : "Add and select"}
                        </button>
                      </form>
                    )}
                  </div>
                  <div className="max-h-[310px] min-h-24 divide-y divide-slate-100 overflow-y-auto px-3">
                    {cart.map((item, index) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {money(item.price)} each · GST {item.gstRate}%
                            {gstCalculation.discounts[index] > 0
                              ? ` · Discount ${money(gstCalculation.discounts[index])}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            aria-label={`Decrease ${item.name} quantity`}
                            className="h-7 w-7 rounded border border-slate-300 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-medium tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            aria-label={`Increase ${item.name} quantity`}
                            className="h-7 w-7 rounded border border-slate-300 text-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-700"
                          >
                            +
                          </button>
                        </div>
                        <span className="w-20 text-right text-xs font-medium tabular-nums">
                          {money(
                            item.price * item.quantity -
                              (gstCalculation.discounts[index] || 0) +
                              Math.round(
                                (item.price * item.quantity -
                                  (gstCalculation.discounts[index] || 0)) *
                                  item.gstRate,
                              ) /
                                100,
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="rounded px-1 text-xs text-slate-400 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-teal-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {cart.length === 0 && (
                      <p className="py-8 text-center text-xs text-slate-500">
                        Cart is empty. Select a product to begin.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 border-t border-slate-200 px-3 py-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Subtotal</span>
                      <span className="tabular-nums">{money(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">GST</span>
                      <span className="tabular-nums">{money(totalGst)}</span>
                    </div>
                    <label className="flex items-center justify-between gap-3 text-slate-600">
                      Discount
                      <span className="flex items-center gap-1 text-slate-900">
                        <span>₹</span>
                        <input
                          aria-label="Discount amount"
                          type="number"
                          min="0"
                          max={subtotal}
                          step="0.01"
                          value={discount}
                          onChange={(event) => setDiscount(event.target.value)}
                          className="h-8 w-24 rounded border border-slate-300 px-2 text-right text-xs tabular-nums outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                        />
                      </span>
                    </label>
                    <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
                      <span>Total</span>
                      <span className="tabular-nums">{money(total)}</span>
                    </div>
                  </div>
                  <div className="border-t border-slate-200 px-3 py-3">
                    <p className="mb-2 text-xs font-medium text-slate-700">
                      Payment method
                    </p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        ["upi", "UPI"],
                        ["cash", "Cash"],
                        ["card", "Card"],
                        ["bank", "Bank"],
                        ["other", "Other"],
                      ].map(([method, label]) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          aria-pressed={paymentMethod === method}
                          className={`h-8 rounded border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-700 ${paymentMethod === method ? "border-teal-700 bg-teal-50 text-teal-800" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={splitPayment}
                        onChange={(event) =>
                          setSplitPayment(event.target.checked)
                        }
                      />
                      Split payment
                    </label>
                    {splitPayment && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="grid gap-1 text-[11px] text-slate-500">
                          Second method
                          <select
                            value={splitMethod}
                            onChange={(event) =>
                              setSplitMethod(event.target.value)
                            }
                            className="h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                          >
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="card">Card</option>
                            <option value="bank">Bank</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                        <label className="grid gap-1 text-[11px] text-slate-500">
                          Second amount
                          <input
                            type="number"
                            min="0"
                            max={total}
                            step="0.01"
                            value={splitAmount}
                            onChange={(event) =>
                              setSplitAmount(event.target.value)
                            }
                            className="h-8 rounded border border-slate-300 px-2 text-xs"
                          />
                        </label>
                      </div>
                    )}
                    <label className="mt-2 grid gap-1 text-[11px] text-slate-500">
                      {paymentMethod === "cash" && !splitPayment
                        ? "Cash tendered (leave blank for exact amount)"
                        : "Amount received now (leave blank for full payment)"}
                      <input
                        aria-label="Amount received now"
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(event) =>
                          setPaymentAmount(event.target.value)
                        }
                        className="h-8 rounded border border-slate-300 px-2 text-xs"
                      />
                    </label>
                    <div className="mt-2 space-y-1 rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs">
                      <div className="flex justify-between">
                        <span>Received</span>
                        <span>{money(appliedPreview)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Remaining</span>
                        <span>{money(balancePreview)}</span>
                      </div>
                      {changePreview > 0 && (
                        <div className="flex justify-between font-medium text-slate-900">
                          <span>Change to return</span>
                          <span>{money(changePreview)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-200 pt-1 font-medium">
                        <span>Status</span>
                        <span>
                          {balancePreview === 0
                            ? "Paid"
                            : appliedPreview > 0
                              ? "Partially paid"
                              : "Unpaid"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={checkout}
                      disabled={processing || cart.length === 0}
                      className="mt-2.5 h-10 w-full rounded bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {processing ? "Saving sale…" : `Charge ${money(total)}`}
                    </button>
                    {completedBill && (
                      <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-emerald-900">
                            Receipt preview · {completedBill.billNumber}
                          </span>
                          <button
                            type="button"
                            onClick={printBill}
                            className="rounded px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-teal-700"
                          >
                            Print / reprint
                          </button>
                        </div>
                        <div className="mt-2 space-y-1 text-[11px] text-emerald-900">
                          {completedBill.items.map((item, index) => (
                            <div
                              key={`${item.id}-${index}`}
                              className="flex justify-between gap-2"
                            >
                              <span className="truncate">
                                {item.quantity} × {item.name}
                              </span>
                              <span className="tabular-nums">
                                {money(item.total)}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t border-emerald-200 pt-1 font-semibold">
                            <span>
                              {completedBill.paymentStatus} · paid{" "}
                              {money(completedBill.paidAmount)}
                            </span>
                            <span>{money(completedBill.total)}</span>
                          </div>
                          {completedBill.balanceDue > 0 && (
                            <div className="flex justify-between">
                              <span>Remaining balance</span>
                              <span>{money(completedBill.balanceDue)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : page === "Transactions" ? (
            <section className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
                <div>
                  <h2 className="text-sm font-semibold">Transaction history</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Bills created by your account
                  </p>
                </div>
                <span className="text-xs tabular-nums text-slate-500">
                  {transactions.length} shown
                </span>
              </div>
              <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
                <input
                  aria-label="Search bills by number or customer"
                  value={historySearch}
                  onChange={(event) => {
                    setHistorySearch(event.target.value);
                    setHistoryPage(1);
                  }}
                  placeholder="Search bill number or customer"
                  className="h-9 min-w-48 flex-1 rounded border border-slate-300 px-2.5 text-xs"
                />
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  From
                  <input
                    aria-label="Filter bills from date"
                    type="date"
                    value={historyFrom}
                    onChange={(event) => {
                      setHistoryFrom(event.target.value);
                      setHistoryPage(1);
                    }}
                    className="h-9 rounded border border-slate-300 px-2 text-xs text-slate-700"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  To
                  <input
                    aria-label="Filter bills to date"
                    type="date"
                    value={historyTo}
                    onChange={(event) => {
                      setHistoryTo(event.target.value);
                      setHistoryPage(1);
                    }}
                    className="h-9 rounded border border-slate-300 px-2 text-xs text-slate-700"
                  />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {[
                        "Bill",
                        "Date",
                        "Customer",
                        "Payment",
                        "Status",
                        "Items",
                        "Total",
                        "Actions",
                      ].map((heading) => (
                        <th key={heading} className="px-3 py-2.5 font-medium">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((bill) => (
                      <tr key={bill.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium">
                          {bill.billNumber || bill.id.slice(-8).toUpperCase()}{" "}
                          {bill.isReturn && (
                            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              Return
                            </span>
                          )}
                          {bill.isCancelled && (
                            <span className="ml-1 rounded bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">
                          {new Date(bill.date).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2.5">{bill.customerName}</td>
                        <td className="px-3 py-2.5 uppercase text-slate-600">
                          {bill.paymentMethod}
                        </td>
                        <td className="px-3 py-2.5 capitalize text-slate-600">
                          {bill.paymentStatus}
                        </td>
                        <td className="px-3 py-2.5 tabular-nums">
                          {bill.items.reduce(
                            (count, item) => count + item.quantity,
                            0,
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-medium tabular-nums">
                          {money(bill.total)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setCompletedBill(bill);
                                navigate("/staff/billing");
                              }}
                              className="font-medium text-teal-800 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-700"
                            >
                              View / reprint
                            </button>
                            {!bill.isReturn &&
                              !bill.isCancelled &&
                              bill.balanceDue > 0 && (
                                <button
                                  type="button"
                                  onClick={() => collectBillPayment(bill)}
                                  className="font-medium text-teal-700 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-700"
                                >
                                  Collect
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {loadingHistory && (
                  <p className="p-5 text-center text-xs text-slate-500">
                    Loading bill history…
                  </p>
                )}
                {!loadingHistory && transactions.length === 0 && (
                  <p className="p-5 text-center text-xs text-slate-500">
                    No saved bills match these filters.
                  </p>
                )}
                <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs">
                  <span className="text-slate-500">
                    Page {historyPage} of {historyTotalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={historyPage <= 1 || loadingHistory}
                      onClick={() => setHistoryPage((page) => page - 1)}
                      className="rounded border border-slate-300 px-2.5 py-1.5 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={
                        historyPage >= historyTotalPages || loadingHistory
                      }
                      onClick={() => setHistoryPage((page) => page + 1)}
                      className="rounded border border-slate-300 px-2.5 py-1.5 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <StaffPortalPages page={page} />
          )}

          <footer className="flex justify-between px-1 py-4 text-[11px] text-slate-500">
            <span>StockPilot · Staff portal</span>
            <span>{page}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
