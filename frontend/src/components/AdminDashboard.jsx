import { useState } from "react";
import ProductManagement from "./ProductManagement";

const navigation = [
  { name: "Overview", icon: "⌂" },
  { name: "Inventory", icon: "▦" },
  { name: "Products", icon: "◇" },
  { name: "Categories", icon: "▤" },
  { name: "Orders", icon: "ORD" },
  { name: "Customers", icon: "USR" },
  { name: "Reports", icon: "▥" },
  { name: "Settings", icon: "SET" },
];

const stats = [
  {
    label: "Total Products",
    value: "1,248",
    detail: "+12 this month",
    icon: "▦",
    color: "bg-teal-50 text-teal-700",
  },
  {
    label: "Low Stock",
    value: "36",
    detail: "Requires attention",
    icon: "!",
    color: "bg-amber-50 text-amber-700",
  },
  {
    label: "Orders Today",
    value: "124",
    detail: "18 pending",
    icon: "UP",
    color: "bg-violet-50 text-violet-700",
  },
  {
    label: "Monthly Revenue",
    value: "₹12.48L",
    detail: "+14.2% this month",
    icon: "₹",
    color: "bg-emerald-50 text-emerald-700",
  },
];

const products = [
  {
    name: "Wireless Headphones",
    category: "Electronics",
    sku: "ELC-1001",
    stock: 84,
    price: "₹4,999",
    icon: "H",
    color: "bg-violet-100",
  },
  {
    name: "Smart Watch Pro",
    category: "Electronics",
    sku: "ELC-1002",
    stock: 12,
    price: "₹6,299",
    icon: "W",
    color: "bg-blue-100",
  },
  {
    name: "Cotton T-Shirt",
    category: "Apparel",
    sku: "APP-2001",
    stock: 6,
    price: "₹1,299",
    icon: "T",
    color: "bg-lime-100",
  },
  {
    name: "LED Desk Lamp",
    category: "Home & Kitchen",
    sku: "HOM-3001",
    stock: 42,
    price: "₹2,499",
    icon: "L",
    color: "bg-amber-100",
  },
];

const orders = [
  {
    id: "ORD-7841",
    product: "Wireless Headphones",
    customer: "Akhil K.",
    date: "Nov 03, 2026",
    total: "₹4,999",
    status: "Delivered",
  },
  {
    id: "ORD-7840",
    product: "Smart Watch Pro",
    customer: "Neha R.",
    date: "Nov 03, 2026",
    total: "₹6,299",
    status: "Processing",
  },
  {
    id: "ORD-7839",
    product: "Cotton T-Shirt",
    customer: "Vishnu M.",
    date: "Nov 02, 2026",
    total: "₹1,299",
    status: "Shipped",
  },
];

const statusStyles = {
  Delivered: "bg-emerald-100 text-emerald-700",
  Processing: "bg-blue-100 text-blue-700",
  Shipped: "bg-teal-100 text-teal-700",
  Cancelled: "bg-red-100 text-red-700",
};

export default function Dashboard() {
  const [activePage, setActivePage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.category} ${product.sku}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const filteredOrders = orders.filter((order) =>
    `${order.id} ${order.product} ${order.customer}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#eeebfc] p-3 font-sans text-[#171717] sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[28px] border border-black/10 bg-[#faf9f7] shadow-[0_24px_65px_rgba(30,25,55,0.16)]">
        <div className="flex min-h-[850px] flex-col">
          <header className="relative z-20 flex min-h-[68px] items-center justify-between gap-4 bg-[#111111] px-5 py-3 text-white sm:px-8">
            <button
              type="button"
              onClick={() => setActivePage("Overview")}
              className="shrink-0 text-xl font-bold tracking-tight"
            >
              Stock<span className="text-[#65c6b8]">Pilot</span>
              <span className="text-[#65c6b8]">.</span>
            </button>

            <nav className="hidden items-center gap-1 xl:flex">
              {[
                ["Overview", "⌂"],
                ["Inventory", "▦"],
                ["Orders", "ORD"],
                ["Reports", "▥"],
              ].map(([name, icon]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActivePage(name)}
                  className={`rounded-xl px-4 py-2 text-xs transition ${
                    activePage === name
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="mr-2">{icon}</span>
                  {name}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3 sm:gap-5">
              <label className="hidden items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 md:flex">
                <svg
                  className="h-4 w-4 text-white/60"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products, orders..."
                  className="w-44 bg-transparent text-xs outline-none placeholder:text-white/45 lg:w-56"
                />
              </label>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  aria-label="Notifications"
                  className="relative rounded-lg p-2 text-lg hover:bg-white/10"
                >
                  U
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#65c6b8]" />
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-black/10 bg-white p-4 text-sm text-slate-800 shadow-xl">
                    <h3 className="font-semibold">Notifications</h3>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      36 products are running low on stock.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActivePage("Inventory");
                        setNotificationsOpen(false);
                      }}
                      className="mt-3 text-xs font-semibold text-teal-700"
                    >
                      View inventory
                    </button>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 rounded-xl p-1 hover:bg-white/10"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#d4f0e8] to-[#6bb8aa] text-sm font-bold text-[#174b45]">
                    A
                  </div>
                  <div className="hidden text-left sm:block">
                    <p className="text-xs font-semibold">Admin</p>
                    <p className="text-[10px] text-white/50">Administrator</p>
                  </div>
                  <span className="text-xs text-white/60">⌄</span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-12 z-30 w-44 rounded-xl border border-black/10 bg-white p-2 text-sm text-slate-800 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setActivePage("Settings");
                        setMenuOpen(false);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                    >
                      Account settings
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuOpen(false)}
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col md:flex-row">
            <aside className="border-b border-black/[0.07] bg-white/70 p-3 md:w-[205px] md:shrink-0 md:border-b-0 md:border-r md:p-4 lg:w-[225px]">
              <div className="mb-3 flex items-center justify-between px-3 md:mt-4">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Workspace
                </span>
              </div>

              <nav className="flex gap-1 overflow-x-auto md:flex-col">
                {navigation.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setActivePage(item.name)}
                    className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                      activePage === item.name
                        ? "bg-[#dff1ed] font-semibold text-[#176b61] shadow-[inset_3px_0_0_#19796d]"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-lg">
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </nav>

              <div className="mt-8 hidden rounded-2xl border border-[#d9ebe5] bg-[#eff8f5] p-4 md:block">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg text-teal-700">
                  UP
                </div>
                <p className="text-sm font-semibold">Inventory status</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Keep your product stock updated and organized.
                </p>
                <button
                  type="button"
                  onClick={() => setActivePage("Inventory")}
                  className="mt-3 text-xs font-semibold text-teal-800"
                >
                  Open inventory →
                </button>
              </div>
            </aside>

            <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
              <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                    Admin workspace
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {activePage === "Overview"
                      ? "Good morning, Admin!"
                      : activePage}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Here's what's happening with your store today.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActivePage("Products")}
                  className="flex items-center justify-center gap-2 self-start rounded-xl bg-[#176f65] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#125b53] sm:self-auto"
                >
                  <span className="text-lg">+</span>
                  Add product
                </button>
              </div>

              {activePage === "Products" || activePage === "Inventory" ? (
                <ProductManagement />
              ) : <>
              <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_3px_12px_rgba(0,0,0,0.025)] sm:p-5"
                  >
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-500 sm:text-sm">
                        {stat.label}
                      </span>
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${stat.color}`}
                      >
                        {stat.icon}
                      </span>
                    </div>
                    <p className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-[10px] text-slate-500 sm:text-xs">
                      {stat.detail}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                <section className="rounded-2xl border border-black/[0.07] bg-white p-4 sm:p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">
                        Quick access
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Manage your store operations
                      </p>
                    </div>
                    <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                      4 sections
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        title: "Products",
                        detail: "Manage your catalog",
                        icon: "▦",
                        color: "bg-teal-100 text-teal-800",
                        page: "Products",
                      },
                      {
                        title: "Inventory",
                        detail: "Track stock levels",
                        icon: "◇",
                        color: "bg-amber-100 text-amber-800",
                        page: "Inventory",
                      },
                      {
                        title: "Orders",
                        detail: "Review purchases",
                        icon: "UP",
                        color: "bg-violet-100 text-violet-800",
                        page: "Orders",
                      },
                      {
                        title: "Categories",
                        detail: "Organize products",
                        icon: "▤",
                        color: "bg-blue-100 text-blue-800",
                        page: "Categories",
                      },
                    ].map((item) => (
                      <button
                        key={item.title}
                        type="button"
                        onClick={() => setActivePage(item.page)}
                        className="group flex min-h-28 items-start gap-3 rounded-xl border border-black/[0.07] bg-[#fcfbf9] p-3 text-left transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/40 sm:p-4"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${item.color}`}
                        >
                          {item.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {item.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {item.detail}
                          </span>
                          <span className="mt-2 block text-xs text-teal-700 opacity-0 transition group-hover:opacity-100">
                            Open →
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-black/[0.07] bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-semibold">Low stock alerts</h2>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
                      36 items
                    </span>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        name: "Cotton T-Shirt",
                        sku: "APP-2001",
                        stock: 6,
                        color: "bg-red-500",
                      },
                      {
                        name: "Smart Watch Pro",
                        sku: "ELC-1002",
                        stock: 12,
                        color: "bg-amber-500",
                      },
                      {
                        name: "USB-C Hub",
                        sku: "ELC-1014",
                        stock: 9,
                        color: "bg-amber-500",
                      },
                    ].map((item) => (
                      <div
                        key={item.sku}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f1eb] text-lg">
                            ▦
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {item.name}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {item.sku}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold">
                            {item.stock} left
                          </p>
                          <span
                            className={`mt-1 inline-block h-1.5 w-12 rounded-full ${item.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActivePage("Inventory")}
                    className="mt-5 w-full rounded-xl border border-black/10 px-4 py-2.5 text-xs font-semibold transition hover:bg-slate-50"
                  >
                    View all low-stock products →
                  </button>
                </section>
              </div>

              <section className="mb-6 rounded-2xl border border-black/[0.07] bg-white p-4 sm:p-5">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="text-base font-semibold">
                      Product inventory
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Recently updated products
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePage("Products")}
                    className="self-start text-xs font-semibold text-teal-800 hover:text-teal-950"
                  >
                    View all products →
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  {filteredProducts.map((product) => (
                    <article
                      key={product.sku}
                      className="overflow-hidden rounded-xl border border-black/[0.07] transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div
                        className={`flex h-28 items-center justify-center ${product.color}`}
                      >
                        <span className="text-5xl">{product.icon}</span>
                      </div>
                      <div className="p-3.5">
                        <p className="truncate text-sm font-semibold">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {product.category}
                        </p>
                        <p className="mt-3 text-[10px] text-slate-400">
                          SKU: {product.sku}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {product.price}
                          </span>
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] font-semibold ${
                              product.stock <= 10
                                ? "bg-red-50 text-red-700"
                                : product.stock <= 15
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {product.stock} in stock
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {filteredProducts.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No products found.
                  </p>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
                <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
                  <div>
                    <h2 className="text-base font-semibold">Recent orders</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Latest customer purchases
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePage("Orders")}
                    className="shrink-0 text-xs font-semibold text-teal-800 hover:text-teal-950"
                  >
                    View all →
                  </button>
                </div>

                <div className="overflow-x-auto px-4 pb-4 sm:px-5">
                  <table className="w-full min-w-[680px] text-left text-xs">
                    <thead>
                      <tr className="bg-[#f5f4f1] text-slate-500">
                        {[
                          "Order ID",
                          "Product",
                          "Customer",
                          "Date",
                          "Status",
                          "Total",
                        ].map((heading) => (
                          <th
                            key={heading}
                            className="px-3 py-3 font-medium first:rounded-l-lg last:rounded-r-lg"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-black/[0.06] last:border-0 hover:bg-slate-50/70"
                        >
                          <td className="whitespace-nowrap px-3 py-4 font-semibold">
                            {order.id}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            {order.product}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-slate-600">
                            {order.customer}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-slate-500">
                            {order.date}
                          </td>
                          <td className="px-3 py-4">
                            <span
                              className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                statusStyles[order.status] ||
                                "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 font-semibold">
                            {order.total}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredOrders.length === 0 && (
                    <p className="py-8 text-center text-sm text-slate-500">
                      No orders found.
                    </p>
                  )}
                </div>
              </section>
              </>}
            </main>
          </div>

          <footer className="flex flex-col justify-between gap-3 border-t border-black/[0.07] bg-white/60 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-8">
            <p>
              <span className="font-semibold text-slate-800">StockPilot</span>
              {" "}© 2026. All rights reserved.
            </p>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setActivePage("Settings")}
                className="transition hover:text-teal-800"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => setActivePage("Settings")}
                className="transition hover:text-teal-800"
              >
                Terms
              </button>
              <button
                type="button"
                onClick={() => setActivePage("Settings")}
                className="transition hover:text-teal-800"
              >
                Support
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
