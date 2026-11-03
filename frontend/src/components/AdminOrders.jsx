import { useEffect, useState } from "react";
const api = import.meta.env.VITE_SERVER_URL?.replace(/\/+$/, "");
const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    Number(value || 0),
  );
export default function AdminOrders() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `${api}/bills/history?limit=100&search=${encodeURIComponent(search)}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.message || "Could not load sales");
        if (active) setBills(result.bills || []);
      } catch (cause) {
        if (active) setError(cause.message);
      } finally {
        if (active) setLoading(false);
      }
    };
    const timer = setTimeout(load, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Completed and partially paid point-of-sale bills, shown as sales
        history.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search bill number, customer or staff"
        className="h-9 w-full max-w-sm rounded border border-slate-300 px-3 text-sm"
      />
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {[
                "Bill",
                "Date",
                "Customer",
                "Staff",
                "Payment",
                "Status",
                "Total",
                "",
              ].map((x) => (
                <th key={x} className="px-3 py-2.5 font-medium">
                  {x}
                </th>
              ))}
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
                  {bill.paymentMethod || bill.paymentStatus}
                </td>
                <td className="px-3 py-2.5 capitalize">
                  {bill.isCancelled
                    ? "Cancelled"
                    : bill.paymentStatus || "Paid"}
                </td>
                <td className="px-3 py-2.5 font-medium">
                  {money(bill.totalAmount)}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => setSelected(bill)}
                    className="font-medium text-teal-800"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <p className="p-6 text-center text-sm text-slate-500">
            Loading sales…
          </p>
        )}
        {!loading && bills.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            No sales found.
          </p>
        )}
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Bill details"
            className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex justify-between">
              <div>
                <h2 className="font-semibold">
                  Bill {selected.billNumber || selected._id.slice(-8)}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(selected.createdAt).toLocaleString("en-IN")}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded px-2 text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="mt-4 divide-y divide-slate-100 border-y">
              {(selected.products || []).map((item, i) => (
                <div
                  key={`${item.productId}-${i}`}
                  className="flex justify-between gap-3 py-2 text-sm"
                >
                  <span>
                    {item.quantity} × {item.name}
                  </span>
                  <span>{money(item.total)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <p className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(selected.subtotal)}</span>
              </p>
              <p className="flex justify-between">
                <span>GST</span>
                <span>{money(selected.totalGst)}</span>
              </p>
              <p className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{money(selected.totalAmount)}</span>
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
