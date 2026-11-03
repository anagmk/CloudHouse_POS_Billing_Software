import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import AdminDashboard from "../components/AdminDashboard";
import StaffDashboard from "../components/StaffDashboard";
import { API_BASE_URL } from "../utils/api";

const dashboardByRole = {
  admin: "/admin",
  staff: "/staff",
};

export default function RoleRoute({ requiredRole }) {
  const serverUrl = API_BASE_URL;
  const [status, setStatus] = useState(() =>
    localStorage.getItem("token") && serverUrl ? "loading" : "unauthenticated",
  );
  const [role, setRole] = useState(null);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem("token");

    if (!token || !serverUrl) {
      return () => {
        active = false;
      };
    }

    fetch(`${serverUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Session expired");

        const verifiedRole = data.user?.role;
        if (!dashboardByRole[verifiedRole]) {
          throw new Error("User role is invalid");
        }

        if (active) {
          setRole(verifiedRole);
          setStatus("authenticated");
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        if (active) setStatus("unauthenticated");
      });

    return () => {
      active = false;
    };
  }, [serverUrl]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking your account…
      </main>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  const userDashboard = dashboardByRole[role];
  if (!requiredRole || role !== requiredRole) {
    return <Navigate to={userDashboard} replace />;
  }

  return role === "admin" ? <AdminDashboard /> : <StaffDashboard />;
}
