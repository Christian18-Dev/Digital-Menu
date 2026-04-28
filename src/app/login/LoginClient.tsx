"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./LoginClient.module.css";

export default function LoginClient() {
  const searchParams = useSearchParams();

  const nextPath = useMemo(() => {
    const candidate = searchParams?.get("next");
    return candidate && candidate.startsWith("/") ? candidate : "/dashboard";
  }, [searchParams]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }

      window.location.assign(nextPath);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <form onSubmit={onSubmit} className={styles.form}>
        <p>
          Welcome,<span>sign in to continue</span>
        </p>

        <input
          type="text"
          placeholder="Username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />

        <input
          type="password"
          placeholder="Password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <div className={styles.error}>{error}</div>}

        <button type="submit" className={styles.oauthButton} disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Continue"}
          <svg
            className={styles.icon}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 17 5-5-5-5"></path>
            <path d="m13 17 5-5-5-5"></path>
          </svg>
        </button>
      </form>
    </div>
  );
}
