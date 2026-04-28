"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ConnectionBadge from "./ConnectionBadge";
import { SocketConnectionProvider } from "@/lib/socket-connection";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navItems = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/menus", label: "Menu" },
      { href: "/displays", label: "Display" },
    ],
    []
  );

  return (
    <SocketConnectionProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen w-full">
          <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-6 md:block">
            <div className="px-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Digital Menu System
              </p>
              <div className="mt-3">
                <ConnectionBadge />
              </div>
            </div>

            <nav className="mt-6 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      "block rounded-md px-3 py-2 text-sm font-semibold transition " +
                      (isActive
                        ? "bg-slate-900 text-white"
                        : "text-slate-700 hover:bg-slate-50")
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 border-t border-slate-200 pt-4">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={async () => {
                  if (isLoggingOut) return;
                  setIsLoggingOut(true);
                  try {
                    await fetch("/api/auth/logout", { method: "POST" });
                  } finally {
                    router.replace("/login");
                    router.refresh();
                    setIsLoggingOut(false);
                  }
                }}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </aside>

          {isMobileNavOpen && (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setIsMobileNavOpen(false)}
                className="absolute inset-0 bg-slate-900/40"
              />
              <aside className="absolute left-0 top-0 h-full w-72 border-r border-slate-200 bg-white px-4 py-6 shadow-lg">
                <div className="flex items-center justify-between px-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Digital Menu System
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsMobileNavOpen(false)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 shadow-sm"
                  >
                    ✕
                  </button>
                </div>

              <nav className="mt-6 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileNavOpen(false)}
                      className={
                        "block rounded-md px-3 py-2 text-sm font-semibold transition " +
                        (isActive
                          ? "bg-slate-900 text-white"
                          : "text-slate-700 hover:bg-slate-50")
                      }
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-8 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  disabled={isLoggingOut}
                  onClick={async () => {
                    if (isLoggingOut) return;
                    setIsLoggingOut(true);
                    try {
                      await fetch("/api/auth/logout", { method: "POST" });
                    } finally {
                      setIsMobileNavOpen(false);
                      router.replace("/login");
                      router.refresh();
                      setIsLoggingOut(false);
                    }
                  }}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </aside>
          </div>
        )}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4 shadow-sm md:hidden">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(true)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Menu
                </button>
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Digital Menu System
                  </p>
                  <ConnectionBadge />
                </div>
              </div>
            </header>

            <main className="flex-1 px-6 py-8">{children}</main>
          </div>
        </div>
      </div>
    </SocketConnectionProvider>
  );
}
