"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import type { Display, Menu } from "@/lib/types";

type BootstrapPayload = {
  menus?: Menu[];
  displays?: Display[];
};

export default function DashboardPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [displays, setDisplays] = useState<Display[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [branchFilter, setBranchFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [menusRes, displaysRes, branchesRes] = await Promise.all([
          fetch("/api/menus"),
          fetch("/api/displays"),
          fetch("/api/branches"),
        ]);
        if (menusRes.ok) {
          const data = await menusRes.json().catch(() => ({}));
          setMenus(data.menus ?? []);
        }
        if (displaysRes.ok) {
          const data = await displaysRes.json().catch(() => ({}));
          setDisplays(data.displays ?? []);
        }
        if (branchesRes.ok) {
          const data = await branchesRes.json().catch(() => ({}));
          setBranches(Array.isArray(data.branches) ? data.branches : []);
        }
      } catch {
        // ignore; socket bootstrap will likely hydrate
      }
    };

    loadInitial();

    const socket = getSocket();
    socket.emit("subscribeAdmin");
    socket.on("connect", () => socket.emit("subscribeAdmin"));
    socket.on("bootstrap", (payload: BootstrapPayload) => {
      if (payload?.menus) setMenus(payload.menus);
      if (payload?.displays) setDisplays(payload.displays);
    });
    socket.on("menusUpdated", (next: Menu[]) => setMenus(next));
    socket.on("displaysUpdated", (next: Display[]) => setDisplays(next));

    return () => {
      socket.off("connect");
      socket.off("bootstrap");
      socket.off("menusUpdated");
      socket.off("displaysUpdated");
    };
  }, []);

  const menusById = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  const filteredDisplays = useMemo(() => {
    const q = query.trim().toLowerCase();
    return displays.filter((d) => {
      const matchesBranch = branchFilter === "all" ? true : d.branch === branchFilter;
      if (!matchesBranch) return false;
      if (!q) return true;
      const assignedMenuNames = resolveDisplayMenus(d, menusById)
        .map((m) => m.name)
        .join(" ")
        .toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.branch ?? "").toLowerCase().includes(q) ||
        assignedMenuNames.includes(q)
      );
    });
  }, [branchFilter, displays, menusById, query]);

  const filteredMenus = useMemo(() => {
    if (branchFilter === "all") return menus;
    return menus.filter((m) => {
      const b = (m.branch ?? "").trim();
      return b.length === 0 || b === branchFilter;
    });
  }, [branchFilter, menus]);

  const summary = useMemo(() => {
    const online = filteredDisplays.filter((d) => !!d.online).length;
    return {
      menuCount: filteredMenus.length,
      displayCount: filteredDisplays.length,
      onlineCount: online,
    };
  }, [filteredDisplays, filteredMenus]);

  const recentMenus = useMemo(
    () => [...filteredMenus].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [filteredMenus]
  );

  const recentDisplays = useMemo(
    () => [...filteredDisplays].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6),
    [filteredDisplays]
  );

  const branchSummary = useMemo(() => {
    const branchNames = Array.from(
      new Set(
        [
          ...branches,
          ...displays.map((d) => d.branch).filter((b): b is string => typeof b === "string"),
          ...menus.map((m) => (m.branch ?? "").trim()).filter(Boolean),
        ].map((b) => b.trim()).filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    return branchNames.map((b) => {
      const displayForBranch = displays.filter((d) => d.branch === b);
      const onlineCount = displayForBranch.filter((d) => !!d.online).length;
      const menusForBranch = menus.filter((m) => {
        const mb = (m.branch ?? "").trim();
        return mb.length === 0 || mb === b;
      });
      return {
        branch: b,
        displayCount: displayForBranch.length,
        onlineCount,
        menuCount: menusForBranch.length,
      };
    });
  }, [branches, displays, menus]);

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-6 border-b border-slate-200 bg-slate-50/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-slate-50/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-600">Overview</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-80">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
              />
            </div>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 sm:w-56"
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Menus" value={summary.menuCount} />
        <StatCard title="Displays" value={summary.displayCount} />
        <StatCard title="Online" value={summary.onlineCount} />
      </section>

      <section>
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Displays</h2>
            </div>
            <span className="text-xs text-slate-500">
              {filteredDisplays.length} item{filteredDisplays.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {filteredDisplays.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-600">No displays found.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                <div className="hidden grid-cols-[minmax(0,24rem)_24rem_24rem_24rem] items-center gap-3 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 sm:grid">
                  <span>Name</span>
                  <span className="text-right">Menus</span>
                  <span className="text-right">Status</span>
                  <span className="text-right">Last seen</span>
                </div>
                {filteredDisplays
                  .slice()
                  .sort((a, b) => {
                    const aOnline = a.online ? 1 : 0;
                    const bOnline = b.online ? 1 : 0;
                    if (aOnline !== bOnline) return bOnline - aOnline;
                    return (b.lastSeen ?? 0) - (a.lastSeen ?? 0);
                  })
                  .slice(0, 12)
                  .map((d) => {
                    const assignedMenus = resolveDisplayMenus(d, menusById);
                    const assignedCount = getAssignedMenuIds(d).length;
                    const statusText = d.online
                      ? "Online"
                      : d.lastSeen
                        ? `Last seen ${formatRelativeTime(d.lastSeen)}`
                        : "Offline";

                    return (
                      <div key={d.id} className="px-4 py-2.5">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,24rem)_24rem_24rem_24rem] sm:items-center sm:gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900">{d.name}</p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">{assignedCount}</p>
                          </div>

                          <div className="flex items-center justify-end">
                            <div className="inline-flex items-center gap-1">
                              <span
                                title={statusText}
                                className={
                                  "inline-flex h-2.5 w-2.5 rounded-full " +
                                  (d.online ? "bg-emerald-500" : "bg-red-500")
                                }
                              />
                              <p
                                className={
                                  "text-sm font-semibold leading-none " +
                                  (d.online ? "text-emerald-700" : "text-red-700")
                                }
                              >
                                {d.online ? "Online" : "Offline"}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-xs font-semibold text-slate-700">
                              {d.online
                                ? "Now"
                                : d.lastSeen
                                  ? formatRelativeTime(d.lastSeen)
                                  : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent menus</h2>
            <Link href="/menus" className="text-sm font-semibold text-slate-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {recentMenus.length === 0 ? (
              <p className="text-sm text-slate-600">No menus.</p>
            ) : (
              recentMenus.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{m.name}</p>
                    <p className="truncate text-xs text-slate-500">{m.branch || "—"}</p>
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">{formatRelativeTime(m.updatedAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent displays</h2>
            <Link href="/displays" className="text-sm font-semibold text-slate-700 hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {recentDisplays.length === 0 ? (
              <p className="text-sm text-slate-600">No displays.</p>
            ) : (
              recentDisplays.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{d.name}</p>
                    <p className="truncate text-xs text-slate-500">{d.branch || "—"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500">{formatRelativeTime(d.updatedAt)}</p>
                    <p className="text-xs font-semibold text-slate-700">{d.online ? "Online" : "Offline"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Branches</h2>
          <span className="text-xs text-slate-500">Summary</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {branchSummary.length === 0 ? (
            <p className="text-sm text-slate-600">No branches found.</p>
          ) : (
            branchSummary.map((b) => (
              <button
                key={b.branch}
                type="button"
                onClick={() => setBranchFilter(b.branch)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{b.branch}</p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{b.displayCount}</p>
                    <p className="text-xs text-slate-500">Displays</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{b.onlineCount}</p>
                    <p className="text-xs text-slate-500">Online</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{b.menuCount}</p>
                    <p className="text-xs text-slate-500">Menus</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function getAssignedMenuIds(display: Display): string[] {
  if (Array.isArray(display.menuIds)) return display.menuIds;
  if (typeof display.menuId === "string" && display.menuId.trim().length > 0) return [display.menuId];
  return [];
}

function resolveDisplayMenus(display: Display, menusById: Map<string, Menu>): Menu[] {
  const ids = getAssignedMenuIds(display);
  return ids.map((id) => menusById.get(id)).filter((m): m is Menu => !!m);
}

function formatRelativeTime(ts: number) {
  const delta = Date.now() - ts;
  if (delta < 0) return "just now";
  const seconds = Math.floor(delta / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
