import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const serverUrl = import.meta.env.VITE_SERVER_URL?.replace(/\/+$/, "");
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setNotice(null);
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setNotice(null);

    try {
      if (!serverUrl) {
        throw new Error(
          "Login service is not configured. Set VITE_SERVER_URL in frontend/.env and restart Vite.",
        );
      }

      const response = await fetch(`${serverUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      if (!data.token) {
        throw new Error(
          "Login succeeded but the server did not return an authentication token.",
        );
      }
      if (!data.user || !["admin", "staff"].includes(data.user.role)) {
        throw new Error(
          "The server did not return a valid user role. Please contact support.",
        );
      }

      localStorage.setItem("token", data.token);
      navigate(data.user.role === "admin" ? "/admin" : "/staff", {
        replace: true,
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof TypeError
            ? "Could not reach the login service. Check that the backend is running and VITE_SERVER_URL is correct."
            : error.message || "Login failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-sky-100 via-blue-100 to-cyan-100 px-4 py-6 text-slate-800">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-200/40 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[30rem] w-[30rem] rounded-full bg-blue-300/40 blur-3xl" />

      <section className="relative z-10 w-full max-w-md rounded-[2rem] border border-white/80 bg-white/55 p-5 shadow-[0_25px_80px_rgba(75,125,180,0.15)] backdrop-blur-2xl sm:p-6">
        <div className="mb-6 flex flex-col items-center">
          <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/90 bg-gradient-to-br from-white via-sky-200 to-blue-300 shadow-[0_0_40px_rgba(95,190,235,0.35)]">
            <div className="absolute inset-2 rounded-full border border-white/70" />
            <div className="h-9 w-9 rounded-[45%_55%_65%_35%/45%_40%_60%_55%] bg-gradient-to-br from-cyan-300 via-blue-400 to-indigo-300 shadow-[inset_3px_3px_10px_rgba(255,255,255,0.9),inset_-3px_-3px_10px_rgba(58,110,200,0.25)]" />
            <div className="absolute left-3.5 top-3.5 h-4 w-6 rotate-[-30deg] rounded-full bg-white/70 blur-[2px]" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            Welcome back to
          </p>

          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-800">
            StockPilot<span className="text-sky-600">.</span>
          </h1>
        </div>

        <div className="mb-5">
          <h2 className="text-xl font-semibold text-slate-800">
            Sign in to your account
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your credentials to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {notice && (
            <p
              role={notice.type === "error" ? "alert" : "status"}
              className={`rounded-xl px-4 py-3 text-sm ${
                notice.type === "error"
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {notice.message}
            </p>
          )}

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Email address
            </label>

            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              maxLength={254}
              required
              className="w-full rounded-xl border border-sky-200/80 bg-white/65 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 hover:border-sky-300 focus:border-sky-500 focus:bg-white/90 focus:ring-4 focus:ring-sky-100"
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <a
                href="/forgot-password"
                className="text-xs font-semibold text-sky-700 transition hover:text-sky-900"
              >
                Forgot password?
              </a>
            </div>

            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full rounded-xl border border-sky-200/80 bg-white/65 px-4 py-3 pr-16 text-sm outline-none transition placeholder:text-slate-400 hover:border-sky-300 focus:border-sky-500 focus:bg-white/90 focus:ring-4 focus:ring-sky-100"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-4 text-xs font-medium text-sky-700 hover:text-sky-900"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:from-sky-700 hover:to-blue-700 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}

            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </form>

        <div className="my-5 flex items-center gap-4">
          <div className="h-px flex-1 bg-slate-300/70" />
          <span className="text-xs text-slate-400">SECURE LOGIN</span>
          <div className="h-px flex-1 bg-slate-300/70" />
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Don't have an account?{" "}
          <a
            href="/signup"
            className="font-semibold text-sky-700 transition hover:text-sky-900"
          >
            Create account
          </a>
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          Your information stays secure.
        </div>
      </section>
    </main>
  );
}
