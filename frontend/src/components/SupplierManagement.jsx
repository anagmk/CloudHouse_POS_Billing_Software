import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../utils/api";

const serverUrl = API_BASE_URL;
const emptySupplier = {
  name: "",
  companyName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  gstNumber: "",
  paymentTerms: "Cash",
  address: { street: "", city: "", state: "", pincode: "", country: "India" },
  notes: "",
};

const paymentTerms = ["Cash", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"];

export default function SupplierManagement() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptySupplier);
  const [message, setMessage] = useState(null);

  const request = useCallback(
    async (path, options = {}) => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/login", { replace: true });
        throw new Error("Sign in to manage suppliers.");
      }
      if (!serverUrl)
        throw new Error(
          "Supplier service is not configured. Set VITE_SERVER_URL.",
        );

      const response = await fetch(`${serverUrl}/suppliers${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem("token");
        navigate("/login", { replace: true });
      }
      if (!response.ok)
        throw new Error(data.message || "Supplier request failed.");
      return data;
    },
    [navigate],
  );

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await request("/getAll");
      if (!Array.isArray(data))
        throw new Error("Supplier service returned an invalid response.");
      setSuppliers(data);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not load suppliers.",
      });
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    Promise.resolve().then(loadSuppliers);
  }, [loadSuppliers]);

  const visibleSuppliers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? supplier.isActive : !supplier.isActive);
      const matchesQuery =
        !search ||
        [
          supplier.name,
          supplier.companyName,
          supplier.phone,
          supplier.alternatePhone,
          supplier.email,
        ].some((value) => value?.toLowerCase().includes(search));
      return matchesStatus && matchesQuery;
    });
  }, [suppliers, query, statusFilter]);

  const closeDialog = () => {
    setDialog(null);
    setForm(emptySupplier);
  };

  const openCreate = () => {
    setForm(emptySupplier);
    setDialog({ mode: "create" });
    setMessage(null);
  };

  const openDetails = async (supplier, mode) => {
    setMessage(null);
    setDetailLoading(true);
    setDialog({ mode, supplier: null });
    try {
      const details = await request(`/get/${supplier._id}`);
      if (mode === "edit") {
        setForm({
          ...emptySupplier,
          ...details,
          address: { ...emptySupplier.address, ...details.address },
        });
      }
      setDialog({ mode, supplier: details });
    } catch (error) {
      setDialog(null);
      setMessage({
        type: "error",
        text: error.message || "Could not load supplier details.",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const updateField = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const updateAddress = (field, value) =>
    setForm((current) => ({
      ...current,
      address: { ...current.address, [field]: value },
    }));

  const saveSupplier = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      ...form,
      name: form.name.trim(),
      companyName: form.companyName.trim(),
      phone: form.phone.trim(),
      alternatePhone: form.alternatePhone.trim(),
      email: form.email.trim().toLowerCase(),
      gstNumber: form.gstNumber.trim().toUpperCase(),
    };
    try {
      const isEdit = dialog?.mode === "edit";
      await request(isEdit ? `/update/${dialog.supplier._id}` : "/add", {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      closeDialog();
      setMessage({
        type: "success",
        text: isEdit ? "Supplier updated." : "Supplier created.",
      });
      await loadSuppliers();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not save supplier.",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (supplier) => {
    const action = supplier.isActive ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} ${supplier.name}?`))
      return;
    setMessage(null);
    try {
      await request(`/update/${supplier._id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });
      setMessage({
        type: "success",
        text: `${supplier.name} ${supplier.isActive ? "deactivated" : "activated"}.`,
      });
      await loadSuppliers();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Could not update supplier status.",
      });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Suppliers
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Manage supplier contacts and payment terms.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="h-9 rounded-md bg-teal-700 px-3.5 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2"
        >
          Add supplier
        </button>
      </div>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`rounded-md border px-3 py-2 text-sm ${message.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 px-2.5 focus-within:border-teal-700 focus-within:ring-1 focus-within:ring-teal-700">
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
            aria-label="Search suppliers"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, company, phone, or email"
            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
          />
        </label>
        <select
          aria-label="Filter suppliers by status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:border-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-700"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-xs tabular-nums text-slate-500">
          {visibleSuppliers.length} suppliers
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[930px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Supplier",
                  "Company",
                  "Contact",
                  "GST number",
                  "Payment terms",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="px-3 py-2.5 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleSuppliers.map((supplier) => (
                <tr key={supplier._id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {supplier.name}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {supplier.companyName || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="block text-slate-800">
                      {supplier.phone}
                    </span>
                    <span className="mt-0.5 block text-slate-500">
                      {supplier.email || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-slate-600">
                    {supplier.gstNumber || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {supplier.paymentTerms || "Cash"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center rounded px-2 py-1 text-[10px] font-medium ${supplier.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {supplier.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openDetails(supplier, "view")}
                        className="font-medium text-slate-600 hover:text-slate-950 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-700"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openDetails(supplier, "edit")}
                        className="font-medium text-teal-800 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatus(supplier)}
                        className="font-medium text-slate-600 hover:text-slate-950 hover:underline focus:outline-none focus:ring-2 focus:ring-teal-700"
                      >
                        {supplier.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading && (
          <p className="p-8 text-center text-sm text-slate-500">
            Loading suppliers…
          </p>
        )}
        {!loading && !visibleSuppliers.length && (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              {suppliers.length
                ? "No suppliers match your filters."
                : "No suppliers yet."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {suppliers.length
                ? "Try another search or status."
                : "Add a supplier to keep their details available to your team."}
            </p>
          </div>
        )}
      </div>

      {dialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-3"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-dialog-title"
            className="my-auto w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h2
                  id="supplier-dialog-title"
                  className="text-sm font-semibold"
                >
                  {dialog.mode === "create"
                    ? "Add supplier"
                    : dialog.mode === "edit"
                      ? "Edit supplier"
                      : "Supplier details"}
                </h2>
                {dialog.mode === "view" && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Supplier record
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeDialog}
                aria-label="Close dialog"
                className="rounded px-2 py-1 text-lg leading-none text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            {detailLoading ? (
              <p className="p-10 text-center text-sm text-slate-500">
                Loading supplier details…
              </p>
            ) : dialog.mode === "view" ? (
              <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2">
                {[
                  ["Name", dialog.supplier.name],
                  ["Company", dialog.supplier.companyName],
                  ["Phone", dialog.supplier.phone],
                  ["Alternate phone", dialog.supplier.alternatePhone],
                  ["Email", dialog.supplier.email],
                  ["GST number", dialog.supplier.gstNumber],
                  ["Payment terms", dialog.supplier.paymentTerms],
                  ["Status", dialog.supplier.isActive ? "Active" : "Inactive"],
                  ["Street", dialog.supplier.address?.street],
                  ["City", dialog.supplier.address?.city],
                  ["State", dialog.supplier.address?.state],
                  ["PIN code", dialog.supplier.address?.pincode],
                  ["Country", dialog.supplier.address?.country],
                  ["Notes", dialog.supplier.notes],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                      {value || "—"}
                    </p>
                  </div>
                ))}
                <div className="flex justify-end sm:col-span-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="h-9 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={saveSupplier}
                className="max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-700">
                    Supplier name{" "}
                    <input
                      required
                      maxLength={120}
                      value={form.name}
                      onChange={(event) =>
                        updateField("name", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Company name{" "}
                    <input
                      maxLength={160}
                      value={form.companyName}
                      onChange={(event) =>
                        updateField("companyName", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Phone{" "}
                    <input
                      required
                      type="tel"
                      maxLength={24}
                      value={form.phone}
                      onChange={(event) =>
                        updateField("phone", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Alternate phone{" "}
                    <input
                      type="tel"
                      maxLength={24}
                      value={form.alternatePhone}
                      onChange={(event) =>
                        updateField("alternatePhone", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Email{" "}
                    <input
                      type="email"
                      maxLength={254}
                      value={form.email}
                      onChange={(event) =>
                        updateField("email", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    GST number{" "}
                    <input
                      maxLength={20}
                      value={form.gstNumber}
                      onChange={(event) =>
                        updateField("gstNumber", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal uppercase outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Payment terms{" "}
                    <select
                      value={form.paymentTerms}
                      onChange={(event) =>
                        updateField("paymentTerms", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    >
                      {paymentTerms.map((term) => (
                        <option key={term}>{term}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Street address{" "}
                    <input
                      value={form.address.street}
                      onChange={(event) =>
                        updateAddress("street", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    City{" "}
                    <input
                      value={form.address.city}
                      onChange={(event) =>
                        updateAddress("city", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    State{" "}
                    <input
                      value={form.address.state}
                      onChange={(event) =>
                        updateAddress("state", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    PIN code{" "}
                    <input
                      value={form.address.pincode}
                      onChange={(event) =>
                        updateAddress("pincode", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700">
                    Country{" "}
                    <input
                      value={form.address.country}
                      onChange={(event) =>
                        updateAddress("country", event.target.value)
                      }
                      className="mt-1.5 h-9 w-full rounded-md border border-slate-300 px-2.5 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-700 sm:col-span-2">
                    Notes{" "}
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(event) =>
                        updateField("notes", event.target.value)
                      }
                      className="mt-1.5 w-full resize-y rounded-md border border-slate-300 px-2.5 py-2 text-sm font-normal outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    onClick={closeDialog}
                    className="h-9 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-9 rounded-md bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? "Saving…"
                      : dialog.mode === "create"
                        ? "Create supplier"
                        : "Save changes"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
