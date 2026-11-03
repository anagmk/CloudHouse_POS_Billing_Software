import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../utils/api";

const inputClass =
  "mt-1.5 h-9 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10";

export default function StaffManagement() {
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [details, setDetails] = useState(null);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "staff",
  });

  const api = API_BASE_URL;
  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  });

  const loadStaff = useCallback(async () => {
    if (!api) {
      setError("Staff service is not configured. Set VITE_SERVER_URL.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${api}/staff/getAll`, {
        headers: headers(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load staff");
      setStaff(Array.isArray(data) ? data.filter((user) => user.role === "staff") : []);
    } catch (requestError) {
      setError(requestError.message || "Could not load staff");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return staff.filter((member) => {
      const matchesQuery =
        !query ||
        member.username?.toLowerCase().includes(query) ||
        member.email?.toLowerCase().includes(query);
      const matchesStatus =
        status === "all" || (status === "active" ? member.isActive !== false : member.isActive === false);
      return matchesQuery && matchesStatus;
    });
  }, [staff, search, status]);

  const openCreate = () => {
    setEditing(null);
    setForm({ username: "", email: "", password: "", role: "staff" });
    setFormOpen(true);
  };

  const openEdit = (member) => {
    setEditing(member);
    setForm({
      username: member.username || "",
      email: member.email || "",
      password: "",
      role: "staff",
    });
    setFormOpen(true);
  };

  const saveStaff = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const editingMember = Boolean(editing);
      const response = await fetch(
        editingMember
          ? `${api}/staff/update/${editing._id}`
          : `${api}/staff/add`,
        {
          method: editingMember ? "PUT" : "POST",
          headers: headers(),
          body: JSON.stringify(
            editingMember
              ? { username: form.username, email: form.email, role: "staff", isActive: editing.isActive }
              : form,
          ),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save staff member");
      setFormOpen(false);
      setNotice(editingMember ? "Staff member updated." : "Staff member added.");
      await loadStaff();
    } catch (requestError) {
      setError(requestError.message || "Could not save staff member");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (member) => {
    const nextActive = member.isActive === false;
    const action = nextActive ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${member.username}?`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${api}/staff/update/${member._id}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({
          username: member.username,
          email: member.email,
          role: "staff",
          isActive: nextActive,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `Could not ${action} staff member`);
      setNotice(`Staff member ${nextActive ? "activated" : "deactivated"}.`);
      await loadStaff();
    } catch (requestError) {
      setError(requestError.message || `Could not ${action} staff member`);
    }
  };

  const viewDetails = async (member) => {
    try {
      const response = await fetch(`${api}/staff/get/${member._id}`, {
        headers: headers(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load staff details");
      setDetails(data);
    } catch (requestError) {
      setError(requestError.message || "Could not load staff details");
    }
  };

  const deleteStaff = async (member) => {
    if (
      !window.confirm(
        `Permanently delete ${member.username}? This cannot be undone. Deactivating the account is safer for staff with transaction history.`,
      )
    ) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${api}/staff/delete/${member._id}`, {
        method: "DELETE",
        headers: headers(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not delete staff member");
      setNotice("Staff member deleted.");
      await loadStaff();
    } catch (requestError) {
      setError(requestError.message || "Could not delete staff member");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Team accounts</h2>
          <p className="mt-1 text-xs text-slate-500">
            Add staff, update account details, and manage access.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="h-9 rounded bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700/30"
        >
          Add staff member
        </button>
      </div>

      {error && <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <div className="flex flex-col gap-2 rounded border border-slate-200 bg-white p-3 sm:flex-row">
        <input
          aria-label="Search staff"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or email"
          className="h-9 min-w-0 flex-1 rounded border border-slate-300 px-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10"
        />
        <select
          aria-label="Filter by account status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-9 rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-700"
        >
          <option value="all">All accounts</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button type="button" onClick={loadStaff} className="h-9 rounded border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">
          Refresh
        </button>
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Staff member</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">Loading staff…</td></tr>
              ) : filteredStaff.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-sm text-slate-500">{staff.length ? "No staff match these filters." : "No staff accounts yet."}</td></tr>
              ) : filteredStaff.map((member) => (
                <tr key={member._id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-900">{member.username}</td>
                  <td className="px-4 py-3 text-slate-600">{member.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs ${member.isActive === false ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                      {member.isActive === false ? "Inactive" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{member.createdAt ? new Date(member.createdAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <button type="button" onClick={() => viewDetails(member)} className="text-xs font-medium text-slate-600 hover:text-slate-950">View</button>
                      <button type="button" onClick={() => openEdit(member)} className="text-xs font-medium text-teal-800 hover:text-teal-950">Edit</button>
                      <button type="button" onClick={() => toggleActive(member)} className="text-xs font-medium text-slate-600 hover:text-slate-950">
                        {member.isActive === false ? "Activate" : "Deactivate"}
                      </button>
                      <button type="button" onClick={() => deleteStaff(member)} className="text-xs font-medium text-red-700 hover:text-red-900">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          {loading ? "Loading…" : `${filteredStaff.length} of ${staff.length} staff accounts`}
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setFormOpen(false)}>
          <form onSubmit={saveStaff} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{editing ? "Edit staff member" : "Add staff member"}</h3>
                <p className="mt-1 text-xs text-slate-500">Staff accounts can access the staff workspace.</p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Close" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
            </div>
            <label className="block text-sm font-medium text-slate-700">
              Name
              <input required autoFocus value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className={inputClass} />
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700">
              Email
              <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} />
            </label>
            {!editing && (
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Temporary password
                <input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className={inputClass} />
                <span className="mt-1 block text-xs font-normal text-slate-500">At least 8 characters.</span>
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="h-9 rounded border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button disabled={saving} className="h-9 rounded bg-teal-700 px-3 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Saving…" : editing ? "Save changes" : "Create account"}
              </button>
            </div>
          </form>
        </div>
      )}

      {details && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDetails(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="staff-details-title" className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <h3 id="staff-details-title" className="text-base font-semibold">Staff details</h3>
              <button type="button" onClick={() => setDetails(null)} aria-label="Close" className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100">×</button>
            </div>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              <div className="flex justify-between gap-4 py-2"><dt className="text-slate-500">Name</dt><dd className="text-right font-medium">{details.username}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-slate-500">Email</dt><dd className="break-all text-right font-medium">{details.email}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-slate-500">Status</dt><dd className="font-medium">{details.isActive === false ? "Inactive" : "Active"}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-slate-500">Created</dt><dd className="font-medium">{details.createdAt ? new Date(details.createdAt).toLocaleString() : "—"}</dd></div>
              <div className="flex justify-between gap-4 py-2"><dt className="text-slate-500">Last updated</dt><dd className="font-medium">{details.updatedAt ? new Date(details.updatedAt).toLocaleString() : "—"}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </section>
  );
}
