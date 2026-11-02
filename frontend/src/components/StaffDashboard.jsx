import { useMemo, useState } from "react";

const initialProducts = [
  { id: "P001", name: "Cotton T-Shirt", category: "Apparel", price: 799, stock: 24, color: "bg-lime-100", icon: "T" },
  { id: "P002", name: "Denim Jeans", category: "Apparel", price: 1499, stock: 18, color: "bg-blue-100", icon: "J" },
  { id: "P003", name: "Formal Shirt", category: "Apparel", price: 1199, stock: 12, color: "bg-violet-100", icon: "S" },
  { id: "P004", name: "Running Shoes", category: "Footwear", price: 2499, stock: 15, color: "bg-orange-100", icon: "R" },
  { id: "P005", name: "Leather Belt", category: "Accessories", price: 599, stock: 30, color: "bg-amber-100", icon: "B" },
  { id: "P006", name: "Wrist Watch", category: "Accessories", price: 1899, stock: 9, color: "bg-teal-100", icon: "W" },
  { id: "P007", name: "Casual Kurti", category: "Apparel", price: 999, stock: 20, color: "bg-pink-100", icon: "K" },
  { id: "P008", name: "Sports Cap", category: "Accessories", price: 399, stock: 16, color: "bg-sky-100", icon: "C" },
];

const categories = ["All", "Apparel", "Footwear", "Accessories"];

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

export default function StaffDashboard() {
  const [products, setProducts] = useState(initialProducts);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [completedBill, setCompletedBill] = useState(null);
  const [notice, setNotice] = useState("");
  const [processing, setProcessing] = useState(false);
  const [transactions, setTransactions] = useState([]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        category === "All" || product.category === category;

      const matchesSearch =
        `${product.name} ${product.id} ${product.category}`
          .toLowerCase()
          .includes(search.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const discountAmount = Math.min(
    subtotal,
    Math.max(0, Number(discount) || 0)
  );

  const total = Math.max(0, subtotal - discountAmount);

  const cartCount = cart.reduce(
    (count, item) => count + item.quantity,
    0
  );

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
            : item
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
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId) => {
    setCart((current) =>
      current.filter((item) => item.id !== productId)
    );
    setCompletedBill(null);
  };

  const checkout = async () => {
    if (processing) return;

    if (cart.length === 0) {
      setNotice("Add at least one product before checkout.");
      return;
    }

    if (cart.some((item) => {
      const product = products.find((p) => p.id === item.id);
      return !product || item.quantity > product.stock;
    })) {
      setNotice("Stock has changed. Review the cart before checkout.");
      return;
    }

    setProcessing(true);
    setNotice("");

    try {
      const bill = {
        id: `BILL-${Date.now().toString().slice(-8)}`,
        date: new Date().toLocaleString("en-IN"),
        customerName: customerName.trim() || "Walk-in Customer",
        customerPhone: customerPhone.trim(),
        paymentMethod,
        items: cart.map((item) => ({ ...item })),
        subtotal,
        discount: discountAmount,
        total,
      };

      setProducts((current) =>
        current.map((product) => {
          const purchased = cart.find((item) => item.id === product.id);

          return purchased
            ? { ...product, stock: product.stock - purchased.quantity }
            : product;
        })
      );

      setTransactions((current) => [bill, ...current]);
      setCompletedBill(bill);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscount(0);
      setNotice("Bill completed successfully.");
    } catch {
      setNotice("Unable to complete the bill. Please try again.");
    } finally {
      setProcessing(false);
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
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${money(item.price * item.quantity)}</td>
          </tr>
        `
      )
      .join("");

    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt ${bill.id}</title>
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
          <p>Bill: ${bill.id}</p>
          <p>${bill.date}</p>
          <p>Customer: ${bill.customerName}</p>
          <p>Payment: ${bill.paymentMethod}</p>
          <hr>
          <table>
            <thead>
              <tr><th>Product</th><th>Qty</th><th>Amount</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <hr>
          <p class="right">Subtotal: ${money(bill.subtotal)}</p>
          <p class="right">Discount: ${money(bill.discount)}</p>
          <p class="right total">Total: ${money(bill.total)}</p>
          <hr>
          <p>Thank you for shopping with us.</p>
          <script>window.onload = () => window.print();<\/script>
        </body>
      </html>
    `);

    receiptWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-[#eeebfc] p-3 font-sans text-[#171717] sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[28px] border border-black/10 bg-[#faf9f7] shadow-[0_24px_65px_rgba(30,25,55,0.16)]">
        <header className="flex min-h-[70px] items-center justify-between gap-4 bg-[#111111] px-5 py-4 text-white sm:px-8">
          <a href="/staff" className="shrink-0 text-xl font-bold tracking-tight">
            Stock<span className="text-[#65c6b8]">Pilot</span>.
          </a>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Billing terminal
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#d4f0e8] to-[#6bb8aa] font-semibold text-[#174b45]">
              S
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold">Staff Member</p>
              <p className="mt-1 text-[10px] text-white/50">Billing operator</p>
            </div>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/login";
              }}
              className="rounded-lg px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-110px)] lg:grid-cols-[210px_minmax(0,1fr)]">
          <aside className="border-b border-black/10 bg-white/70 p-3 lg:border-b-0 lg:border-r lg:p-5">
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Workspace
            </p>

            <nav className="flex gap-2 overflow-x-auto lg:flex-col">
              {[
                ["⌂", "Dashboard"],
                ["▦", "New Bill"],
                ["▤", "Transactions"],
                ["RET", "Returns"],
              ].map(([icon, name]) => (
                <a
                  key={name}
                  href={
                    name === "Transactions"
                      ? "#transactions"
                      : name === "Returns"
                        ? "/staff/returns"
                        : "#billing"
                  }
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                    name === "New Bill"
                      ? "bg-[#dff1ed] font-semibold text-[#176b61]"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-lg">{icon}</span>
                  {name}
                </a>
              ))}
            </nav>

            <div className="mt-8 hidden rounded-2xl border border-[#d9ebe5] bg-[#eff8f5] p-4 lg:block">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg text-teal-700">
                ✓
              </div>
              <p className="text-sm font-semibold">Terminal ready</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Billing workspace is ready for a new transaction.
              </p>
            </div>
          </aside>

          <main id="billing" className="min-w-0 p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                  Staff workspace
                </div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  New Bill
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Select products and complete the customer payment.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-xl text-teal-800">
                  ▤
                </div>
                <div>
                  <p className="text-xs text-slate-500">Current bill</p>
                  <p className="text-sm font-semibold">{cartCount} items</p>
                </div>
              </div>
            </div>

            {notice && (
              <div
                role="status"
                className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                  notice.includes("successfully")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {notice}
              </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: "Products available", value: products.length, icon: "▦" },
                { label: "Items in bill", value: cartCount, icon: "Items" },
                { label: "Bill subtotal", value: money(subtotal), icon: "₹" },
                { label: "Transactions today", value: transactions.length, icon: "✓" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-black/[0.07] bg-white p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">{item.label}</span>
                    <span className="text-lg text-teal-700">{item.icon}</span>
                  </div>
                  <p className="text-xl font-semibold tracking-tight">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="min-w-0 rounded-2xl border border-black/[0.07] bg-white p-4 sm:p-5">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <h2 className="text-base font-semibold">Select products</h2>

                  <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2.5">
                    <svg
                      className="h-4 w-4 text-slate-400"
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
                      placeholder="Search products..."
                      className="w-full bg-transparent text-xs outline-none sm:w-48"
                    />
                  </label>
                </div>

                <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      className={`shrink-0 rounded-full px-4 py-2 text-xs font-medium transition ${
                        category === item
                          ? "bg-[#176f65] text-white"
                          : "border border-black/10 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                  {filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      disabled={product.stock === 0}
                      onClick={() => addToCart(product)}
                      className="group overflow-hidden rounded-xl border border-black/[0.08] text-left transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div
                        className={`flex h-28 items-center justify-center sm:h-32 ${product.color}`}
                      >
                        <span className="text-5xl transition-transform group-hover:scale-110">
                          {product.icon}
                        </span>
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-semibold">
                          {product.name}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {product.id} · {product.category}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">
                            {money(product.price)}
                          </span>
                          <span
                            className={`text-[10px] ${
                              product.stock <= 10
                                ? "text-red-600"
                                : "text-slate-500"
                            }`}
                          >
                            {product.stock} left
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-center gap-1 rounded-lg bg-[#e3f2ee] py-2 text-xs font-semibold text-[#176b61] transition group-hover:bg-[#176f65] group-hover:text-white">
                          <span className="text-base">+</span>
                          Add to bill
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {filteredProducts.length === 0 && (
                  <p className="py-12 text-center text-sm text-slate-500">
                    No matching products found.
                  </p>
                )}
              </section>

              <section className="min-w-0 rounded-2xl border border-black/[0.07] bg-white p-4 sm:p-5 xl:sticky xl:top-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-base font-semibold">Current bill</h2>
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
                    {cartCount} items
                  </span>
                </div>

                <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name (optional)"
                    maxLength={100}
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-3 text-xs outline-none transition focus:border-teal-600"
                  />
                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Customer phone (optional)"
                    type="tel"
                    maxLength={20}
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-3 text-xs outline-none transition focus:border-teal-600"
                  />
                </div>

                <div className="mb-5 max-h-[340px] space-y-4 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${item.color}`}
                      >
                        {item.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold">
                          {item.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {money(item.price)} each
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-sm hover:bg-slate-100"
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-xs font-semibold">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-sm hover:bg-slate-100"
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.id)}
                            className="ml-auto text-xs text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <p className="shrink-0 text-xs font-semibold">
                        {money(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-black/15 bg-[#faf9f7] px-4 text-center">
                      <span className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-300">Cart</span>
                      <p className="text-sm font-medium text-slate-600">
                        Your bill is empty
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Select a product to get started.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3 border-t border-dashed border-black/15 pt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-medium">{money(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-xs">
                    <label htmlFor="discount" className="text-slate-500">
                      Discount (₹)
                    </label>
                    <input
                      id="discount"
                      type="number"
                      min="0"
                      max={subtotal}
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-24 rounded-lg border border-black/10 px-2 py-2 text-right outline-none focus:border-teal-600"
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-black/[0.07] pt-3">
                    <span className="text-sm font-semibold">Total</span>
                    <span className="text-xl font-semibold tracking-tight">
                      {money(total)}
                    </span>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-3 text-xs font-semibold">Payment method</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      ["UPI", "⌁"],
                      ["Cash", "₹"],
                      ["Card", "▤"],
                    ].map(([method, icon]) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setPaymentMethod(method)}
                        className={`rounded-xl border px-2 py-3 text-xs font-medium transition ${
                          paymentMethod === method
                            ? "border-teal-700 bg-teal-50 text-teal-800"
                            : "border-black/10 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="mb-1 block text-lg">{icon}</span>
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={checkout}
                  disabled={processing || cart.length === 0}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#176f65] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#125b53] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Complete payment"}
                  <span>→</span>
                </button>

                {completedBill && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-800">
                      Payment recorded in this session
                    </p>
                    <p className="mt-1 text-[10px] text-emerald-700">
                      {completedBill.id} · {money(completedBill.total)}
                    </p>
                    <button
                      type="button"
                      onClick={printBill}
                      className="mt-3 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      Print receipt
                    </button>
                  </div>
                )}
              </section>
            </div>

            <section
              id="transactions"
              className="mt-6 overflow-hidden rounded-2xl border border-black/[0.07] bg-white"
            >
              <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
                <div>
                  <h2 className="text-base font-semibold">
                    Recent transactions
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Bills completed during this session
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
                  {transactions.length} bills
                </span>
              </div>

              <div className="overflow-x-auto px-4 pb-4 sm:px-5">
                <table className="w-full min-w-[600px] text-left text-xs">
                  <thead>
                    <tr className="bg-[#f5f4f1] text-slate-500">
                      {["Bill ID", "Customer", "Payment", "Items", "Total", "Action"].map(
                        (heading) => (
                          <th key={heading} className="px-3 py-3 font-medium">
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((bill) => (
                      <tr
                        key={bill.id}
                        className="border-b border-black/[0.06] last:border-0"
                      >
                        <td className="whitespace-nowrap px-3 py-4 font-semibold">
                          {bill.id}
                        </td>
                        <td className="px-3 py-4">{bill.customerName}</td>
                        <td className="px-3 py-4">{bill.paymentMethod}</td>
                        <td className="px-3 py-4">
                          {bill.items.reduce(
                            (count, item) => count + item.quantity,
                            0
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 font-semibold">
                          {money(bill.total)}
                        </td>
                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setCompletedBill(bill);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="font-semibold text-teal-800 hover:text-teal-950"
                          >
                            View receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {transactions.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-500">
                    No transactions completed in this session.
                  </p>
                )}
              </div>
            </section>
          </main>
        </div>

        <footer className="flex flex-col justify-between gap-3 border-t border-black/[0.07] bg-white/60 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-8">
          <p>
            <span className="font-semibold text-slate-800">StockPilot</span>
            {" "}© 2026
          </p>
          <div className="flex gap-5">
            <a href="/staff/help" className="hover:text-teal-800">
              Help
            </a>
            <a href="/staff/policies" className="hover:text-teal-800">
              Policies
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
