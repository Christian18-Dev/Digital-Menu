"use client";

import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import type { Display, Menu } from "@/lib/types";

type DisplayFormState = {
  name: string;
  branch: string;
};

type DisplayDeleteConfirmState =
  | { open: false }
  | { open: true; displayId: string; displayName: string };

type DisplayMenusModalState =
  | { open: false }
  | { open: true; displayId: string };

type DisplayLinkModalState =
  | { open: false }
  | { open: true; displayId: string; link: string };

export default function DisplaysPage() {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingDisplayId, setEditingDisplayId] = useState<string | null>(null);
  const [form, setForm] = useState<DisplayFormState>({ name: "", branch: "" });

  const [pendingMenuIdsByDisplay, setPendingMenuIdsByDisplay] = useState<
    Record<string, string[]>
  >({});
  const [deleteConfirm, setDeleteConfirm] = useState<DisplayDeleteConfirmState>({
    open: false,
  });
  const [menusModal, setMenusModal] = useState<DisplayMenusModalState>({
    open: false,
  });

  const [linkModal, setLinkModal] = useState<DisplayLinkModalState>({ open: false });

  const menusById = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);

  const filteredDisplays = useMemo(() => {
    const q = query.trim().toLowerCase();
    return displays.filter((d) => {
      const matchesBranch = branchFilter === "all" ? true : d.branch === branchFilter;
      if (!matchesBranch) return false;
      if (!q) return true;
      const menuName = d.menuId ? menusById.get(d.menuId)?.name ?? "" : "";
      const menuNames = Array.isArray(d.menuIds)
        ? d.menuIds
            .map((id) => menusById.get(id)?.name ?? "")
            .filter(Boolean)
            .join(" ")
        : "";
      return (
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.branch.toLowerCase().includes(q) ||
        menuName.toLowerCase().includes(q) ||
        menuNames.toLowerCase().includes(q)
      );
    });
  }, [branchFilter, displays, menusById, query]);

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
    socket.on("bootstrap", (payload: { displays?: Display[]; menus?: Menu[] }) => {
      if (payload?.menus) setMenus(payload.menus);
      if (payload?.displays) setDisplays(payload.displays);
    });
    socket.on("displaysUpdated", (next: Display[]) => setDisplays(next));
    socket.on("menusUpdated", (next: Menu[]) => setMenus(next));

    return () => {
      socket.off("connect");
      socket.off("bootstrap");
      socket.off("displaysUpdated");
      socket.off("menusUpdated");
    };
  }, []);

  const beginCreate = () => {
    setEditingDisplayId(null);
    setForm({ name: "", branch: "" });
    setError(null);
    setIsFormOpen(true);
  };

  const beginEdit = (display: Display) => {
    setEditingDisplayId(display.id);
    setForm({ name: display.name, branch: display.branch ?? "" });
    setError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingDisplayId(null);
    setForm({ name: "", branch: "" });
    setError(null);
  };

  const saveDisplay = async () => {
    const name = form.name.trim();
    const branch = form.branch.trim();
    if (!name) {
      setError("Display name is required");
      return;
    }
    if (!branch) {
      setError("Please select a branch");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (editingDisplayId) {
        const res = await fetch(`/api/displays/${editingDisplayId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, branch }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to update display");
        }
        const data = await res.json().catch(() => ({}));
        if (data.display) {
          setDisplays((prev) => {
            const filtered = prev.filter((d) => d.id !== data.display.id);
            return [data.display, ...filtered];
          });
        }
      } else {
        const res = await fetch("/api/displays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, branch }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to create display");
        }
        const data = await res.json().catch(() => ({}));
        if (data.display) {
          setDisplays((prev) => [data.display, ...prev]);
        }
      }
      closeForm();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save display";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const doDeleteDisplay = async (displayId: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/displays/${displayId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete display");
      }
      setDisplays((prev) => prev.filter((d) => d.id !== displayId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete display";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const doAssignMenus = async (displayId: string, nextMenuIds: string[]) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/displays/${displayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuIds: nextMenuIds }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to update display");
      }
      const data = await res.json().catch(() => ({}));
      if (data.display) {
        setDisplays((prev) => prev.map((d) => (d.id === displayId ? data.display : d)));
      }
      setPendingMenuIdsByDisplay((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, displayId)) return prev;
        const { [displayId]: _removed, ...rest } = prev;
        return rest;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update display";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const copyDisplayLink = async (displayId: string) => {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const link = `${origin}/display/${displayId}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // ignore
    }

    setLinkModal({ open: true, displayId, link });
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-6 border-b border-slate-200 bg-slate-50/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-slate-50/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Display</h1>
            <p className="text-sm text-slate-600">
              Create displays, assign menus, and share viewer links.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-80">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search displays, IDs, menus…"
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

            <button
              type="button"
              onClick={beginCreate}
              aria-label="Create a display"
              className="group relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200/60"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              <span className="pointer-events-none absolute -bottom-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                Create a display
              </span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Displays</h2>
          <span className="text-xs text-slate-500">
            {filteredDisplays.length} item{filteredDisplays.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4">
          {filteredDisplays.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-700">No displays found</p>
              <p className="mt-1 text-sm text-slate-500">
                Create a display to generate a viewer link.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredDisplays.map((d) => {
                const isOnline = !!d.online;
                const assignedMenu = d.menuId ? menusById.get(d.menuId) : undefined;
                const assignedMenus = Array.isArray(d.menuIds)
                  ? d.menuIds.map((id) => menusById.get(id)).filter((m): m is Menu => !!m)
                  : [];
                const savedMenuIds = Array.isArray(d.menuIds) ? d.menuIds : [];
                const effectiveMenuIds = Object.prototype.hasOwnProperty.call(
                  pendingMenuIdsByDisplay,
                  d.id
                )
                  ? pendingMenuIdsByDisplay[d.id]
                  : savedMenuIds;
                const hasPendingChanges = (() => {
                  if (effectiveMenuIds.length !== savedMenuIds.length) return true;
                  const a = new Set(effectiveMenuIds);
                  for (const id of savedMenuIds) {
                    if (!a.has(id)) return true;
                  }
                  return false;
                })();
                const effectiveSelectedMenus = effectiveMenuIds
                  .map((id) => menusById.get(id))
                  .filter((m): m is Menu => !!m);
                const assignableMenus = d.branch
                  ? menus.filter((m) => {
                      const menuBranch = (m.branch ?? "").trim();
                      if (menuBranch.length === 0) return true;
                      return menuBranch === d.branch;
                    })
                  : menus;
                return (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "inline-flex h-2.5 w-2.5 shrink-0 rounded-full " +
                              (isOnline ? "bg-emerald-500" : "bg-slate-300")
                            }
                          />
                          <h3 className="truncate text-lg font-semibold text-slate-900">
                            {d.name}
                          </h3>
                        </div>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                          {d.branch || "Unassigned branch"}
                        </p>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">{d.id}</p>
                        <p className="mt-2 text-xs text-slate-500">
                          {isOnline
                            ? "Online"
                            : d.lastSeen
                              ? `Last seen ${formatRelativeTime(d.lastSeen)}`
                              : "Offline"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyDisplayLink(d.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          Link
                        </button>
                        <button
                          type="button"
                          onClick={() => beginEdit(d)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteConfirm({
                              open: true,
                              displayId: d.id,
                              displayName: d.name,
                            })
                          }
                          className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                        Menus on this display
                      </p>

                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700">
                            {effectiveMenuIds.length} selected
                          </p>
                          <p className="text-xs text-slate-500">Plays in order top-to-bottom</p>
                        </div>
                        <button
                          type="button"
                          disabled={isSaving || assignableMenus.length === 0}
                          onClick={() => setMenusModal({ open: true, displayId: d.id })}
                          className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                        >
                          Select menus
                        </button>
                      </div>

                      <p className="text-xs text-slate-500">
                        {effectiveSelectedMenus.length > 0
                          ? `Now showing: ${effectiveSelectedMenus
                              .map((m) => `${m.branch} — ${m.name}`)
                              .join(", ")}`
                          : assignedMenu
                            ? `Now showing: ${assignedMenu.branch} — ${assignedMenu.name}`
                            : "No menu assigned yet."}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            disabled={isSaving}
            onClick={closeForm}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingDisplayId ? "Edit display" : "Create a display"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Set a name for this screen.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Display name
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Front Counter TV"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Branch
                <select
                  value={form.branch}
                  onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
                >
                  <option value="">Select a branch</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              {error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeForm}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  disabled={isSaving}
                  onClick={saveDisplay}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : editingDisplayId ? "Update display" : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm.open && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            disabled={isSaving}
            onClick={() => setDeleteConfirm({ open: false })}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete display</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete "{deleteConfirm.displayName}"?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setDeleteConfirm({ open: false })}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async () => {
                  const id = deleteConfirm.displayId;
                  setDeleteConfirm({ open: false });
                  await doDeleteDisplay(id);
                }}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
              >
                {isSaving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {menusModal.open && (() => {
        const d = displays.find((x) => x.id === menusModal.displayId);
        if (!d) return null;

        const savedMenuIds = Array.isArray(d.menuIds) ? d.menuIds : [];
        const effectiveMenuIds = Object.prototype.hasOwnProperty.call(
          pendingMenuIdsByDisplay,
          d.id
        )
          ? pendingMenuIdsByDisplay[d.id]
          : savedMenuIds;

        const menusByIdLocal = menusById;
        const effectiveSelectedMenus = effectiveMenuIds
          .map((id) => menusByIdLocal.get(id))
          .filter((m): m is Menu => !!m);

        const assignableMenus = d.branch
          ? menus.filter((m) => {
              const menuBranch = (m.branch ?? "").trim();
              if (menuBranch.length === 0) return true;
              return menuBranch === d.branch;
            })
          : menus;

        const hasPendingChanges = (() => {
          if (effectiveMenuIds.length !== savedMenuIds.length) return true;
          const a = new Set(effectiveMenuIds);
          for (const id of savedMenuIds) {
            if (!a.has(id)) return true;
          }
          return false;
        })();

        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <button
              type="button"
              aria-label="Close"
              disabled={isSaving}
              onClick={() => setMenusModal({ open: false })}
              className="absolute inset-0 bg-black/40"
            />
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-slate-900">
                    Select menus for {d.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">Plays in order top-to-bottom</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMenusModal({ open: false })}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">
                    {effectiveMenuIds.length} selected
                  </p>
                  <p className="text-xs text-slate-500">Branch: {d.branch || "All"}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isSaving || assignableMenus.length === 0}
                    onClick={() =>
                      setPendingMenuIdsByDisplay((prev) => ({
                        ...prev,
                        [d.id]: assignableMenus.map((m) => m.id),
                      }))
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() =>
                      setPendingMenuIdsByDisplay((prev) => ({
                        ...prev,
                        [d.id]: [],
                      }))
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || !hasPendingChanges}
                    onClick={async () => {
                      await doAssignMenus(d.id, effectiveMenuIds);
                      setMenusModal({ open: false });
                    }}
                    className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>

                  <button
                    type="button"
                    disabled={isSaving || !hasPendingChanges}
                    onClick={() =>
                      setPendingMenuIdsByDisplay((prev) => {
                        if (!Object.prototype.hasOwnProperty.call(prev, d.id)) return prev;
                        const { [d.id]: _removed, ...rest } = prev;
                        return rest;
                      })
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>

                <div className="max-h-[50vh] space-y-2 overflow-auto pr-1">
                  {assignableMenus.length === 0 ? (
                    <p className="text-xs text-slate-500">No menus available for this branch.</p>
                  ) : (
                    assignableMenus.map((m) => {
                      const checked = effectiveMenuIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={
                            "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition " +
                            (checked ? "bg-slate-50" : "hover:bg-slate-50")
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSaving}
                            onChange={(e) => {
                              setPendingMenuIdsByDisplay((prev) => {
                                const current = Object.prototype.hasOwnProperty.call(prev, d.id)
                                  ? prev[d.id]
                                  : savedMenuIds;
                                const nextMenuIds = e.target.checked
                                  ? current.includes(m.id)
                                    ? current
                                    : [...current, m.id]
                                  : current.filter((id) => id !== m.id);
                                return { ...prev, [d.id]: nextMenuIds };
                              });
                            }}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-800">
                              {m.name}
                            </span>
                            <span className="block truncate text-xs text-slate-500">{m.branch}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  {effectiveSelectedMenus.length > 0
                    ? `Now showing: ${effectiveSelectedMenus
                        .map((m) => `${m.branch} — ${m.name}`)
                        .join(", ")}`
                    : "No menu assigned yet."}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {linkModal.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            disabled={isSaving}
            onClick={() => setLinkModal({ open: false })}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900">Display link</h3>
                <p className="mt-1 text-sm text-slate-600">
                  This link was copied to your clipboard.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLinkModal({ open: false })}
                disabled={isSaving}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <p className="break-all font-mono text-sm text-slate-800">{linkModal.link}</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <a
                  href={linkModal.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                >
                  Open
                </a>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => copyDisplayLink(linkModal.displayId)}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  Copy again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
