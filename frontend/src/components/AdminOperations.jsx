import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../utils/api";

const serverUrl = API_BASE_URL;
const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(value || 0),
  );
const dateValue = (value) =>
  value ? new Date(value).toLocaleDateString("en-IN") : "—";

export default function AdminOperations({ page, onLogin }) {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState({});
  const [catalog, setCatalog] = useState({ suppliers: [], products: [] });
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const request = useCallback(
    async (path, options = {}) => {
      if (!serverUrl)
        throw new Error("Set VITE_SERVER_URL to connect this workspace.");
      const token = localStorage.getItem("token");
      if (!token) {
        onLogin();
        throw new Error("Please sign in again.");
      }
      const response = await fetch(`${serverUrl}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Request failed");
      return result;
    },
    [onLogin],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (page === "Reports") {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const report = await request(
          `/reports${params.size ? `?${params}` : ""}`,
        );
        setSummary(report);
        setData([]);
      } else {
        const paths = {
          Ledger: "/ledger?limit=100",
          Customers: "/customers?limit=100",
          Purchases: "/purchases?limit=100",
          Expenses: "/expenses?limit=100",
          Payments: "/ledger?type=payment&limit=100",
          Inventory: "/stock/movements?limit=100",
        };
        const result = await request(paths[page] || "/reports");
        const key = {
          Ledger: "entries",
          Customers: "customers",
          Purchases: "purchases",
          Expenses: "expenses",
          Payments: "entries",
          Inventory: "movements",
        }[page];
        const rows = result[key] || [];
        setData(
          search
            ? rows.filter((row) =>
                JSON.stringify(row)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
            : rows,
        );
        setSummary(result.totals || null);
      }
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, [page, request, search, from, to]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!["Purchases", "Inventory"].includes(page)) return;
    Promise.all([
      page === "Purchases"
        ? request("/suppliers/getAll?limit=100")
        : Promise.resolve([]),
      request("/products/all?limit=100"),
    ])
      .then(([supplierResult, productResult]) =>
        setCatalog({
          suppliers: Array.isArray(supplierResult)
            ? supplierResult
            : supplierResult.suppliers || [],
          products: productResult.products || [],
        }),
      )
      .catch((cause) => setError(cause.message));
  }, [page, request]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      let path;
      let payload;
      if (page === "Customers") {
        path = "/customers";
        payload = form;
      } else if (page === "Expenses") {
        path = "/expenses";
        payload = {
          ...form,
          amount: Number(form.amount),
          date: form.date || undefined,
        };
      } else if (page === "Purchases") {
        path = "/purchases";
        payload = {
          supplierId: form.supplierId,
          receiveStock: form.receiveStock !== false,
          products: [
            {
              productId: form.productId,
              quantity: Number(form.quantity),
              unitCost: Number(form.unitCost),
              gstRate: Number(form.gstRate || 0),
            },
          ],
          payments:
            Number(form.paidAmount) > 0
              ? [
                  {
                    method: form.method || "cash",
                    amount: Number(form.paidAmount),
                  },
                ]
              : [],
        };
      } else {
        path = "/stock/adjustments";
        payload = {
          productId: form.productId,
          quantityChange: Number(form.quantityChange),
          reason: form.reason,
        };
      }
      await request(path, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload),
      });
      setIdempotencyKey(crypto.randomUUID());
      setForm({});
      setNotice(
        `${page === "Customers" ? "Customer" : page === "Purchases" ? "Purchase" : page === "Expenses" ? "Expense" : "Stock adjustment"} saved successfully.`,
      );
      await load();
    } catch (cause) {
      setError(cause.message);
    }
  };

  const exportCsv = () => {
    const rows =
      page === "Ledger"
        ? data.map((row) => [
            row.date,
            row.reference,
            row.transactionType,
            row.account,
            row.description,
            row.debit,
            row.credit,
            row.balance,
          ])
        : data.map((row) => [
            row._id,
            row.name || row.expenseNumber || row.purchaseNumber,
            row.amount || row.totalAmount || row.phone,
            row.createdAt,
          ]);
    const header =
      page === "Ledger"
        ? [
            "Date",
            "Reference",
            "Type",
            "Account",
            "Description",
            "Debit",
            "Credit",
            "Balance",
          ]
        : ["ID", "Name/Reference", "Amount/Contact", "Date"];
    const content = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    link.download = `${page.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const input = (name, label, type = "text", required = true) => (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        required={required}
        type={type}
        value={form[name] ?? ""}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        className="h-9 rounded border border-slate-300 px-2.5 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
      />
    </label>
  );
  const select = (name, label, options, required = true) => (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <select
        required={required}
        value={form[name] ?? ""}
        onChange={(event) => setForm({ ...form, [name]: event.target.value })}
        className="h-9 rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-900"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="space-y-4">
      {["Customers", "Expenses", "Purchases", "Inventory"].includes(page) && (
        <form
          onSubmit={submit}
          className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {page === "Customers" && (
            <>
              {input("name", "Customer name")}
              {input("phone", "Phone", "tel", false)}
              {input("email", "Email", "email", false)}
              {input("notes", "Notes", "text", false)}
            </>
          )}
          {page === "Expenses" && (
            <>
              {input("category", "Category")}
              {input("description", "Description")}
              {input("amount", "Amount (₹)", "number")}
              {input("date", "Date", "date", false)}
              {select("paymentMethod", "Payment method", [
                ["cash", "Cash"],
                ["upi", "UPI"],
                ["card", "Card"],
                ["bank", "Bank"],
                ["other", "Other"],
              ])}
              {input("reference", "Reference", "text", false)}
            </>
          )}
          {page === "Purchases" && (
            <>
              {select("supplierId", "Supplier", [
                ["", "Choose supplier"],
                ...catalog.suppliers.map((item) => [
                  item._id,
                  `${item.name}${item.companyName ? ` · ${item.companyName}` : ""}`,
                ]),
              ])}
              {select("productId", "Product", [
                ["", "Choose product"],
                ...catalog.products.map((item) => [
                  item._id,
                  `${item.name} · ${item.sku}`,
                ]),
              ])}
              {input("quantity", "Quantity", "number")}
              {input("unitCost", "Unit cost (₹)", "number")}
              {input("gstRate", "GST rate (%)", "number", false)}
              {input("paidAmount", "Amount paid now (₹)", "number", false)}
              {select(
                "method",
                "Payment method",
                [
                  ["cash", "Cash"],
                  ["upi", "UPI"],
                  ["card", "Card"],
                  ["bank", "Bank"],
                  ["other", "Other"],
                ],
                false,
              )}
            </>
          )}
          {page === "Inventory" && (
            <>
              {select("productId", "Product", [
                ["", "Choose product"],
                ...catalog.products.map((item) => [
                  item._id,
                  `${item.name} · ${item.sku} (${item.stockQuantity} in stock)`,
                ]),
              ])}
              {input("quantityChange", "Quantity change (+/-)", "number")}
              {input("reason", "Reason")}
            </>
          )}
          <div className="flex items-end">
            <button className="h-9 rounded bg-teal-700 px-3 text-sm font-semibold text-white hover:bg-teal-800">
              {page === "Customers"
                ? "Add customer"
                : page === "Purchases"
                  ? "Record purchase"
                  : page === "Expenses"
                    ? "Record expense"
                    : "Adjust stock"}
            </button>
          </div>
        </form>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-60 flex-1 gap-2">
          {page === "Reports" ? (
            <>
              <input
                aria-label="Report start date"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-9 rounded border border-slate-300 px-2 text-sm"
              />
              <input
                aria-label="Report end date"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-9 rounded border border-slate-300 px-2 text-sm"
              />
            </>
          ) : (
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${page.toLowerCase()}`}
              className="h-9 w-full max-w-sm rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700"
            />
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="h-9 rounded border border-slate-300 px-3 text-sm hover:bg-slate-50"
          >
            Refresh
          </button>
          <button
            onClick={exportCsv}
            className="h-9 rounded border border-slate-300 px-3 text-sm hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="h-9 rounded border border-slate-300 px-3 text-sm hover:bg-slate-50"
          >
            Print
          </button>
        </div>
      </div>
      {error && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {notice}
        </div>
      )}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">
          Loading {page.toLowerCase()}…
        </p>
      ) : page === "Reports" && summary ? (
        <ReportView report={summary} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {(page === "Ledger" || page === "Payments"
                  ? [
                      "Date",
                      "Reference",
                      "Type",
                      "Account / Description",
                      "Debit",
                      "Credit",
                      "Balance",
                    ]
                  : page === "Customers"
                    ? ["Customer", "Phone", "Email", "Status", "Created"]
                    : page === "Purchases"
                      ? [
                          "Purchase",
                          "Supplier",
                          "Status",
                          "Payment",
                          "Total",
                          "Date",
                        ]
                      : page === "Expenses"
                        ? [
                            "Reference",
                            "Category",
                            "Description",
                            "Method",
                            "Amount",
                            "Date",
                          ]
                        : [
                            "Date",
                            "Product",
                            "Movement",
                            "Reason",
                            "Change",
                            "Balance",
                          ]
                ).map((heading) => (
                  <th key={heading} className="px-3 py-2.5 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row._id} className="text-slate-700 hover:bg-slate-50">
                  {page === "Ledger" || page === "Payments" ? (
                    <>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {dateValue(row.date)}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        {row.reference}
                      </td>
                      <td className="px-3 py-2.5 capitalize">
                        {row.transactionType}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.account} · {row.description}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.debit ? money(row.debit) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.credit ? money(row.credit) : "—"}
                      </td>
                      <td className="px-3 py-2.5">{money(row.balance)}</td>
                    </>
                  ) : page === "Customers" ? (
                    <>
                      <td className="px-3 py-2.5 font-medium">{row.name}</td>
                      <td className="px-3 py-2.5">{row.phone || "—"}</td>
                      <td className="px-3 py-2.5">{row.email || "—"}</td>
                      <td className="px-3 py-2.5">
                        {row.isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="px-3 py-2.5">
                        {dateValue(row.createdAt)}
                      </td>
                    </>
                  ) : page === "Purchases" ? (
                    <>
                      <td className="px-3 py-2.5 font-medium">
                        {row.purchaseNumber}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.supplierId?.name || "Supplier"}
                      </td>
                      <td className="px-3 py-2.5 capitalize">{row.status}</td>
                      <td className="px-3 py-2.5 capitalize">
                        {row.paymentStatus} · {money(row.paidAmount)} paid
                      </td>
                      <td className="px-3 py-2.5">{money(row.totalAmount)}</td>
                      <td className="px-3 py-2.5">
                        {dateValue(row.createdAt)}
                      </td>
                    </>
                  ) : page === "Expenses" ? (
                    <>
                      <td className="px-3 py-2.5 font-medium">
                        {row.expenseNumber}
                      </td>
                      <td className="px-3 py-2.5">{row.category}</td>
                      <td className="px-3 py-2.5">{row.description}</td>
                      <td className="px-3 py-2.5 uppercase">
                        {row.paymentMethod}
                      </td>
                      <td className="px-3 py-2.5">{money(row.amount)}</td>
                      <td className="px-3 py-2.5">{dateValue(row.date)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2.5">
                        {dateValue(row.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">{row.productId?.name}</td>
                      <td className="px-3 py-2.5 capitalize">
                        {row.movementType}
                      </td>
                      <td className="px-3 py-2.5">{row.reason}</td>
                      <td className="px-3 py-2.5">
                        {row.quantityChange > 0 ? "+" : ""}
                        {row.quantityChange}
                      </td>
                      <td className="px-3 py-2.5">{row.balanceAfter}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!data.length && (
            <p className="py-10 text-center text-sm text-slate-500">
              No {page.toLowerCase()} records found.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ReportView({ report }) {
  const items = [
    ["Gross sales", report.sales.grossSales],
    ["Discounts", report.sales.discounts],
    ["Net sales (excl. GST)", report.sales.netSales],
    ["GST collected", report.sales.gstCollected],
    ["Total billed (incl. GST)", report.sales.totalBilled],
    ["Refunds", report.returns.refunds],
    ["Cash received", report.financial.cashFlowIn],
    ["Receivables", report.financial.receivables],
    ["Supplier payables", report.financial.payables],
    ["Inventory at cost", report.financial.inventoryValue],
    ["Operating expenses", report.financial.operatingExpenses],
    ["Units in stock", report.inventory.units],
    ["Low-stock SKUs", report.inventory.lowStock],
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {items.map(([label, value]) => (
          <div
            key={label}
            className="rounded border border-slate-200 bg-white p-3"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">
              {label.includes("SKUs") ||
              label.includes("stock") ||
              label.includes("Units")
                ? value || 0
                : money(value)}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportTable
          title="Sales by date"
          headers={["Date", "Transactions", "Sales"]}
          rows={report.salesByDay.map((row) => [
            row._id,
            row.transactions,
            money(row.sales),
          ])}
        />
        <ReportTable
          title="Purchases by date"
          headers={["Date", "Purchases", "Total", "Outstanding"]}
          rows={(report.purchasesByDay || []).map((row) => [
            row._id,
            row.count,
            money(row.total),
            money(row.outstanding),
          ])}
        />
        <ReportTable
          title="Purchases by supplier"
          headers={["Supplier", "Purchases", "Total", "Outstanding"]}
          rows={(report.purchasesBySupplier || []).map((row) => [
            row.supplier,
            row.purchases,
            money(row.total),
            money(row.outstanding),
          ])}
        />
        <ReportTable
          title="Top products"
          headers={["Product", "Units", "Sales"]}
          rows={report.salesByProduct.map((row) => [
            row.name,
            row.quantity,
            money(row.sales),
          ])}
        />
        <ReportTable
          title="Payments by method"
          headers={["Method", "Payments", "Amount"]}
          rows={report.salesByMethod.map((row) => [
            row._id,
            row.payments,
            money(row.amount),
          ])}
        />
        <ReportTable
          title="Stock movements"
          headers={["Type", "Records", "Quantity change", "Damaged units"]}
          rows={report.stockMovements.map((row) => [
            row._id,
            row.count,
            row.quantity,
            row.damagedQuantity || 0,
          ])}
        />
      </div>
      <p className="text-xs text-slate-500">
        Profit and loss is not calculated because historical product cost
        allocation is not available. Inventory value uses the currently recorded
        product cost.
      </p>
    </div>
  );
}

function ReportTable({ title, headers, rows }) {
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white">
      <h2 className="border-b border-slate-200 px-3 py-2.5 text-sm font-semibold">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {headers.map((item) => (
                <th className="px-3 py-2 font-medium" key={item}>
                  {item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td className="px-3 py-2" key={cellIndex}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="px-3 py-5 text-center text-xs text-slate-500">
            No report data for this period.
          </p>
        )}
      </div>
    </section>
  );
}
