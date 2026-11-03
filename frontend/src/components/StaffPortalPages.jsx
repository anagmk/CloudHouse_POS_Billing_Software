import { useEffect, useState } from "react";
import { API_BASE_URL } from "../utils/api";

const api = API_BASE_URL;
export default function StaffPortalPages({ page }) {
  const [rows, setRows] = useState([]);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    const endpoint =
      page === "Products"
        ? "/bills/catalog"
        : page === "Customers"
          ? "/customers?limit=100"
          : "/auth/me";
    fetch(`${api}${endpoint}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(async (r) => {
        const result = await r.json().catch(() => ({}));
        if (!r.ok)
          throw new Error(
            result.message || `Could not load ${page.toLowerCase()}`,
          );
        if (!active) return;
        if (page === "Products") setRows(result.products || []);
        else if (page === "Customers") setRows(result.customers || []);
        else setUser(result.user);
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
  }, [page]);
  const filtered = rows.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
  );
  const updatePassword = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${api}/settings/password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(password),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.message || "Could not update password");
      setPassword({ currentPassword: "", newPassword: "" });
      setNotice(result.message);
    } catch (cause) {
      setError(cause.message);
    }
  };
  if (loading)
    return (
      <p className="p-8 text-center text-sm text-slate-500">
        Loading {page.toLowerCase()}…
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
  if (page === "Profile")
    return (
      <div className="max-w-lg space-y-4">
        {notice && (
          <p
            role="status"
            className="rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-800"
          >
            {notice}
          </p>
        )}
        <section className="rounded border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Staff account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd>{user?.username || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd>{user?.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Role</dt>
              <dd className="capitalize">{user?.role || "Staff"}</dd>
            </div>
          </dl>
        </section>
        <form
          onSubmit={updatePassword}
          className="grid gap-3 rounded border border-slate-200 bg-white p-4"
        >
          <h2 className="text-sm font-semibold">Change password</h2>
          <label className="grid gap-1 text-xs text-slate-600">
            Current password
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password.currentPassword}
              onChange={(e) =>
                setPassword({ ...password, currentPassword: e.target.value })
              }
              className="h-9 rounded border border-slate-300 px-2.5 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-600">
            New password
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={password.newPassword}
              onChange={(e) =>
                setPassword({ ...password, newPassword: e.target.value })
              }
              className="h-9 rounded border border-slate-300 px-2.5 text-sm"
            />
          </label>
          <button className="h-9 justify-self-start rounded border border-slate-300 px-3 text-sm font-medium">
            Update password
          </button>
        </form>
      </div>
    );
  return (
    <section className="overflow-hidden rounded border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
        <div>
          <h2 className="text-sm font-semibold">{page}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Read-only {page.toLowerCase()} available to staff.
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${page.toLowerCase()}`}
          className="h-9 w-full max-w-xs rounded border border-slate-300 px-2.5 text-xs"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {(page === "Products"
                ? ["Name", "SKU", "Category", "Price", "Stock"]
                : ["Name", "Phone", "Email", "Notes"]
              ).map((x) => (
                <th key={x} className="px-3 py-2.5 font-medium">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row) =>
              page === "Products" ? (
                <tr key={row._id}>
                  <td className="px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="px-3 py-2.5">{row.sku}</td>
                  <td className="px-3 py-2.5">{row.category}</td>
                  <td className="px-3 py-2.5">₹{row.price}</td>
                  <td className="px-3 py-2.5">{row.stockQuantity}</td>
                </tr>
              ) : (
                <tr key={row._id}>
                  <td className="px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="px-3 py-2.5">{row.phone || "—"}</td>
                  <td className="px-3 py-2.5">{row.email || "—"}</td>
                  <td className="px-3 py-2.5">{row.notes || "—"}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="p-6 text-center text-xs text-slate-500">
            No {page.toLowerCase()} records found.
          </p>
        )}
      </div>
    </section>
  );
}
