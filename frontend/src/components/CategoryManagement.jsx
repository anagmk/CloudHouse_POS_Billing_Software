import { useCallback, useEffect, useState } from "react";

const api = import.meta.env.VITE_SERVER_URL?.replace(/\/+$/, "");
const request = async (path, options = {}) => {
  const response = await fetch(`${api}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Request failed");
  return result;
};

export default function CategoryManagement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({ name: "", description: "" });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try {
      const result = await request(
        `/categories?search=${encodeURIComponent(search)}&limit=100`,
      );
      setRows(result.categories || []);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await request(editing ? `/categories/${editing._id}` : "/categories", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(draft),
      });
      setNotice(editing ? "Category updated." : "Category created.");
      setDraft({ name: "", description: "" });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (row) => {
    if (
      !window.confirm(
        `${row.isActive ? "Deactivate" : "Activate"} ${row.name}?`,
      )
    )
      return;
    try {
      await request(`/categories/${row._id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (row) => {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      await request(`/categories/${row._id}`, { method: "DELETE" });
      setNotice("Category deleted.");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="space-y-4">
      <form
        onSubmit={submit}
        className="grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end"
      >
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Category name
          <input
            required
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-9 rounded border border-slate-300 px-2.5 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-600">
          Description
          <input
            maxLength={300}
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.target.value })
            }
            className="h-9 rounded border border-slate-300 px-2.5 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <button
            disabled={saving}
            className="h-9 rounded bg-teal-700 px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setDraft({ name: "", description: "" });
              }}
              className="h-9 rounded border px-3 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="Search categories"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories"
          className="h-9 w-full max-w-sm rounded border border-slate-300 px-3 text-sm"
        />
        <button
          onClick={load}
          className="h-9 rounded border border-slate-300 px-3 text-sm"
        >
          Refresh
        </button>
      </div>
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
      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">
            Loading categories…
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {[
                  "Category",
                  "Description",
                  "Products",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th className="px-3 py-2.5 font-medium" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row._id}>
                  <td className="px-3 py-2.5 font-medium">{row.name}</td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {row.description || "—"}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {row.productCount || 0}
                  </td>
                  <td className="px-3 py-2.5">
                    {row.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setEditing(row);
                          setDraft({
                            name: row.name,
                            description: row.description || "",
                          });
                        }}
                        className="text-teal-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggle(row)}
                        className="text-slate-700"
                      >
                        {row.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => remove(row)}
                        className="text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !rows.length && (
          <p className="p-8 text-center text-sm text-slate-500">
            No categories found.
          </p>
        )}
      </div>
    </div>
  );
}
