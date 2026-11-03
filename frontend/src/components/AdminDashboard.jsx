import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import ProductManagement from "./ProductManagement";
import SupplierManagement from "./SupplierManagement";
import AdminOperations from "./AdminOperations";
import CategoryManagement from "./CategoryManagement";
import AdminOrders from "./AdminOrders";
import BusinessSettings from "./BusinessSettings";
import StaffManagement from "./StaffManagement";
import SidebarIcon from "./SidebarIcon";
import { API_BASE_URL } from "../utils/api";

const navigation = [
  ["Overview", "/admin", "dashboard"],
  ["Stock", "/admin/inventory", "inventory"],
  ["Products", "/admin/products", "products"],
  ["Categories", "/admin/categories", "categories"],
  ["Suppliers", "/admin/suppliers", "suppliers"],
  ["Orders", "/admin/orders", "orders"],
  ["Customers", "/admin/customers", "customers"],
  ["Staff", "/admin/staff", "staff"],
  ["Purchases", "/admin/purchases", "purchases"],
  ["Expenses", "/admin/expenses", "expenses"],
  ["Ledger", "/admin/ledger", "ledger"],
  ["Payments", "/admin/payments", "payments"],
  ["Reports", "/admin/reports", "reports"],
  ["Settings", "/admin/settings", "settings"],
];

export default function AdminDashboard() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const active =
    navigation.find(([, path]) => path === location.pathname)?.[0] ||
    "Overview";
  useEffect(() => {
    let live = true;
    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (live) setUser(d.user);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const signOut = () => {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  };
  const sidebar = (
    <nav aria-label="Admin navigation" className="space-y-0.5 p-2">
      {navigation.map(([label, path, icon]) => (
        <NavLink
          key={path}
          to={path}
          end={path === "/admin"}
          onClick={() => setDrawerOpen(false)}
          className={({ isActive }) =>
            `flex min-h-10 items-center gap-3 rounded px-3 text-sm ${isActive ? "bg-slate-100 font-medium text-slate-950" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`
          }
        >
          <SidebarIcon name={icon} className="h-[18px] w-[18px] shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
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
          <Link to="/admin" className="text-base font-semibold tracking-tight">
            StockPilot<span className="text-teal-700">.</span>
          </Link>
          <span className="hidden border-l border-slate-200 pl-3 text-sm text-slate-500 sm:block">
            Administration
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-medium">{user?.username || "Admin"}</p>
            <p className="text-[11px] text-slate-500">Administrator</p>
          </div>
          <button
            onClick={signOut}
            className="h-8 rounded border border-slate-300 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1">
        <aside className="hidden w-56 shrink-0 overflow-hidden border-r border-slate-200 bg-white lg:block">
          {sidebar}
        </aside>
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setDrawerOpen(false);
            }}
          >
            <aside className="h-full w-72 max-w-[85vw] overflow-y-auto bg-white shadow-xl">
              <div className="sticky top-0 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
                <span className="text-sm font-semibold">Navigation</span>
                <button
                  aria-label="Close navigation"
                  onClick={() => setDrawerOpen(false)}
                  className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 lg:p-6">
          <div className="mx-auto w-full min-w-0 max-w-[1600px]">
            <div className="mb-4">
              <h1 className="text-lg font-semibold tracking-tight">{active}</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Manage store operations and records.
              </p>
            </div>
            <div className="min-w-0">
              <Routes>
                <Route index element={<Overview />} />
                <Route
                  path="inventory"
                  element={
                    <AdminOperations page="Inventory" onLogin={signOut} />
                  }
                />
                <Route path="products" element={<ProductManagement />} />
                <Route path="categories" element={<CategoryManagement />} />
                <Route path="suppliers" element={<SupplierManagement />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="staff" element={<StaffManagement />} />
                <Route
                  path="customers"
                  element={
                    <AdminOperations page="Customers" onLogin={signOut} />
                  }
                />
                <Route
                  path="purchases"
                  element={
                    <AdminOperations page="Purchases" onLogin={signOut} />
                  }
                />
                <Route
                  path="expenses"
                  element={
                    <AdminOperations page="Expenses" onLogin={signOut} />
                  }
                />
                <Route
                  path="ledger"
                  element={
                    <AdminOperations page="Ledger" onLogin={signOut} />
                  }
                />
                <Route
                  path="payments"
                  element={
                    <AdminOperations page="Payments" onLogin={signOut} />
                  }
                />
                <Route
                  path="reports"
                  element={
                    <AdminOperations page="Reports" onLogin={signOut} />
                  }
                />
                <Route path="settings" element={<BusinessSettings />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Routes>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Overview() {
  const [summary, setSummary] = useState(null);
  const [bills, setBills] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const api = API_BASE_URL;
    const headers = {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    };
    Promise.all([
      fetch(`${api}/reports`, { headers }),
      fetch(`${api}/bills/history?limit=8`, { headers }),
    ])
      .then(async ([a, b]) => {
        const [report, history] = await Promise.all([a.json(), b.json()]);
        if (!a.ok || !b.ok)
          throw new Error(
            report.message ||
              history.message ||
              "Could not load dashboard data",
          );
        if (active) {
          setSummary(report);
          setBills(history.bills || []);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const currency = (v) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(v || 0));
  if (loading)
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Loading current store data…
      </p>
    );
  if (error)
    return (
      <p
        role="alert"
        className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
      >
        {error}
      </p>
    );
  const metrics = [
    ["Sales today", currency(summary?.sales?.totalBilled)],
    ["Low stock items", summary?.inventory?.lowStock ?? 0],
    ["Units in stock", summary?.inventory?.units ?? 0],
    ["Outstanding receivables", currency(summary?.financial?.receivables)],
  ];
  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <section
            key={label}
            className="rounded border border-slate-200 bg-white p-3.5"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
          </section>
        ))}
      </div>
      <section className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-3 py-2.5">
          <h2 className="text-sm font-semibold">Recent sales</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Latest point-of-sale bills across staff accounts
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Bill", "Date", "Customer", "Staff", "Payment", "Total"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2.5 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bills.map((bill) => (
                <tr key={bill._id}>
                  <td className="px-3 py-2.5 font-medium">
                    {bill.billNumber || bill._id.slice(-8)}
                  </td>
                  <td className="px-3 py-2.5">
                    {new Date(bill.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2.5">
                    {bill.customerName || "Walk-in"}
                  </td>
                  <td className="px-3 py-2.5">
                    {bill.createdBy?.username || "—"}
                  </td>
                  <td className="px-3 py-2.5 capitalize">
                    {bill.paymentStatus || "Paid"}
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {currency(bill.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!bills.length && (
            <p className="p-6 text-center text-sm text-slate-500">
              No sales recorded yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
