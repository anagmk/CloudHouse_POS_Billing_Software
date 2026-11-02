import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const emptyForm = {
  name: "",
  price: "",
  category: "",
  stockQuantity: "0",
  gstRate: "0",
};

export default function ProductManagement() {
  const navigate = useNavigate();
  const serverUrl = import.meta.env.VITE_SERVER_URL?.replace(/\/+$/, "");
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const request = useCallback(async (path, options = {}) => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login", { replace: true });
      throw new Error("Please sign in to manage products.");
    }
    if (!serverUrl) throw new Error("Product service is not configured. Set VITE_SERVER_URL.");

    const response = await fetch(`${serverUrl}/products${path}`, {
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
    if (!response.ok) throw new Error(data.message || "Product request failed");
    return data;
  }, [navigate, serverUrl]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request("/all?limit=100");
      setProducts(data.products || []);
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Could not load products." });
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      `${product.name} ${product.category} ${product.sku}`.toLowerCase().includes(term)
    );
  }, [products, search]);

  const startEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      price: String(product.price),
      category: product.category,
      stockQuantity: String(product.stockQuantity),
      gstRate: String(product.gstRate),
    });
    setNotice(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        stockQuantity: Number(form.stockQuantity),
        gstRate: Number(form.gstRate),
      };
      const data = await request(editingId ? `/${editingId}` : "/create", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setNotice({ type: "success", message: data.message || (editingId ? "Product updated." : "Product created.") });
      cancelEdit();
      await loadProducts();
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Could not save product." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    setNotice(null);
    try {
      const data = await request(`/${product._id}`, { method: "DELETE" });
      setNotice({ type: "success", message: data.message || "Product deleted." });
      if (editingId === product._id) cancelEdit();
      await loadProducts();
    } catch (error) {
      setNotice({ type: "error", message: error.message || "Could not delete product." });
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.75fr)]">
      <section className="min-w-0 rounded-2xl border border-black/[0.07] bg-white p-4 sm:p-5">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold">Product catalog</h2>
            <p className="mt-1 text-xs text-slate-500">{products.length} products loaded</p>
          </div>
          <input
            aria-label="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, category, SKU"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-600 sm:max-w-xs"
          />
        </div>

        {notice && (
          <p role={notice.type === "error" ? "alert" : "status"} className={`mb-4 rounded-xl px-4 py-3 text-sm ${notice.type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {notice.message}
          </p>
        )}

        {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading products…</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500">
                  <th className="px-3 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">SKU</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium">Stock</th>
                  <th className="px-3 py-3 font-medium">GST</th>
                  <th className="px-3 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product._id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-3">
                      <p className="font-medium">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.category}</p>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500">{product.sku}</td>
                    <td className="px-3 py-3">₹{Number(product.price).toLocaleString("en-IN")}</td>
                    <td className="px-3 py-3">{product.stockQuantity}</td>
                    <td className="px-3 py-3">{product.gstRate}%</td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => startEdit(product)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50">Edit</button>
                        <button type="button" onClick={() => handleDelete(product)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredProducts.length && <p className="py-10 text-center text-sm text-slate-500">{products.length ? "No matching products." : "No products yet. Add one using the form."}</p>}
          </div>
        )}
      </section>

      <section className="h-fit rounded-2xl border border-black/[0.07] bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold">{editingId ? "Edit product" : "Add a product"}</h2>
        <p className="mt-1 text-xs text-slate-500">Product SKU is generated automatically.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-medium">Product name<input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" /></label>
          <label className="block text-sm font-medium">Category<input required maxLength={80} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">Price<input required min="0" step="0.01" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" /></label>
            <label className="block text-sm font-medium">Stock<input required min="0" step="1" type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" /></label>
          </div>
          <label className="block text-sm font-medium">GST rate (%)<input required min="0" step="0.01" type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-600" /></label>
          <div className="flex gap-2">
            <button disabled={saving} type="submit" className="flex-1 rounded-xl bg-[#176f65] px-4 py-3 text-sm font-semibold text-white hover:bg-[#125b53] disabled:opacity-60">{saving ? "Saving…" : editingId ? "Save changes" : "Create product"}</button>
            {editingId && <button type="button" onClick={cancelEdit} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:bg-slate-50">Cancel</button>}
          </div>
        </form>
      </section>
    </div>
  );
}
