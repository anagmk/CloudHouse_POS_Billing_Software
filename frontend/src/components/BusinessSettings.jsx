import { useEffect, useState } from "react";
const api = import.meta.env.VITE_SERVER_URL?.replace(/\/+$/, "");
const blank = {
  storeName: "",
  address: "",
  phone: "",
  email: "",
  gstin: "",
  receiptFooter: "",
  defaultReorderLevel: 5,
};
async function request(path, options = {}) {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Request failed");
  return result;
}
export default function BusinessSettings() {
  const [form, setForm] = useState(blank);
  const [password, setPassword] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    request("/settings")
      .then((result) => setForm({ ...blank, ...(result.settings || {}) }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await request("/settings", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setForm({ ...blank, ...(result.settings || {}) });
      setNotice("Business settings saved.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setSaving(false);
    }
  };
  const changePassword = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const result = await request("/settings/password", {
        method: "POST",
        body: JSON.stringify(password),
      });
      setPassword({ currentPassword: "", newPassword: "" });
      setNotice(result.message);
    } catch (cause) {
      setError(cause.message);
    }
  };
  const field = (key, label, type = "text") => (
    <label className="grid gap-1 text-xs font-medium text-slate-600">
      {label}
      <input
        required={key === "storeName"}
        type={type}
        value={form[key] ?? ""}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="h-9 rounded border border-slate-300 px-2.5 text-sm text-slate-900"
      />
    </label>
  );
  return (
    <div className="max-w-3xl space-y-4">
      {error && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <p className="p-8 text-center text-sm text-slate-500">
          Loading settings…
        </p>
      ) : (
        <form
          onSubmit={save}
          className="grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-2"
        >
          <h2 className="sm:col-span-2 text-sm font-semibold">
            Business and receipt details
          </h2>
          {field("storeName", "Store name")}
          {field("phone", "Phone", "tel")}
          {field("email", "Business email", "email")}
          {field("gstin", "GSTIN")}
          {field("defaultReorderLevel", "Default reorder level", "number")}
          <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
            Address
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              rows={2}
              className="rounded border border-slate-300 p-2.5 text-sm"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 sm:col-span-2">
            Receipt footer
            <input
              value={form.receiptFooter}
              onChange={(e) =>
                setForm({ ...form, receiptFooter: e.target.value })
              }
              className="h-9 rounded border border-slate-300 px-2.5 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              disabled={saving}
              className="h-9 rounded bg-teal-700 px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save business settings"}
            </button>
          </div>
        </form>
      )}
      <form
        onSubmit={changePassword}
        className="grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-2"
      >
        <h2 className="sm:col-span-2 text-sm font-semibold">
          Change your password
        </h2>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
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
        <label className="grid gap-1 text-xs font-medium text-slate-600">
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
        <div className="sm:col-span-2">
          <button className="h-9 rounded border border-slate-300 px-3 text-sm font-medium">
            Update password
          </button>
        </div>
      </form>
    </div>
  );
}
