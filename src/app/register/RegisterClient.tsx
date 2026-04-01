"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterClient() {
  const router = useRouter();

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/auth/register", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      setAllowed(!!data.allowed);
    };
    load();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Registration failed");
        if (res.status === 403) setAllowed(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (allowed === false) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">Registration disabled</h1>
            <p className="mt-2 text-sm text-slate-600">
              An admin account already exists. Please sign in.
            </p>
            <button
              type="button"
              onClick={() => {
                router.replace("/login");
                router.refresh();
              }}
              className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Create Admin Account</h1>
            <p className="text-sm text-slate-600">
              This is only available until the first account is created.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Username
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none"
                autoComplete="username"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none"
                autoComplete="new-password"
              />
            </label>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || allowed === null}
              className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
            >
              {isSubmitting ? "Creating…" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => {
                router.replace("/login");
                router.refresh();
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Back to login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
