"use client";

import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import type { Menu, MenuType } from "@/lib/types";

type MenuFormState = {
  name: string;
  branch: string;
  imageFiles: File[];
  imagePreviews: string[];
};

type BranchUiState = {
  branches: string[];
  loading: boolean;
  error: string | null;
  editing: boolean;
  newBranchName: string;
  saving: boolean;
};

type BranchConfirmState =
  | { open: false }
  | { open: true; action: "add" | "delete"; name: string };

type MenuConfirmState =
  | { open: false }
  | { open: true; menuId: string; menuName: string };

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [creatingMenu, setCreatingMenu] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editingMenuImageUrls, setEditingMenuImageUrls] = useState<string[] | null>(
    null
  );
  const [isMenuFormOpen, setIsMenuFormOpen] = useState(false);
  const [menuQuery, setMenuQuery] = useState("");
  const [menuBranchFilter, setMenuBranchFilter] = useState<string>("all");
  const [branchUi, setBranchUi] = useState<BranchUiState>({
    branches: [],
    loading: true,
    error: null,
    editing: false,
    newBranchName: "",
    saving: false,
  });
  const [branchConfirm, setBranchConfirm] = useState<BranchConfirmState>({
    open: false,
  });
  const [menuConfirm, setMenuConfirm] = useState<MenuConfirmState>({
    open: false,
  });
  const [menuForm, setMenuForm] = useState<MenuFormState>({
    name: "",
    branch: "",
    imageFiles: [],
    imagePreviews: [],
  });

  const selectedMenuById = useMemo(
    () => new Map(menus.map((m) => [m.id, m])),
    [menus]
  );

  const filteredMenus = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    return menus.filter((m) => {
      const matchesBranch = menuBranchFilter === "all" ? true : m.branch === menuBranchFilter;
      const matchesQuery =
        q.length === 0
          ? true
          : m.name.toLowerCase().includes(q) || m.branch.toLowerCase().includes(q);
      return matchesBranch && matchesQuery;
    });
  }, [menus, menuBranchFilter, menuQuery]);

  useEffect(() => {
    const loadInitial = async () => {
      const res = await fetch("/api/menus");
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      setMenus(data.menus ?? []);
    };
    loadInitial();

    const loadBranches = async () => {
      setBranchUi((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch("/api/branches");
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to load branches");
        }
        const data = await res.json().catch(() => ({}));
        const nextBranches = Array.isArray(data.branches) ? data.branches : [];
        setBranchUi((prev) => ({
          ...prev,
          branches: nextBranches,
          loading: false,
          error: null,
        }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load branches";
        setBranchUi((prev) => ({ ...prev, loading: false, error: msg }));
      }
    };
    loadBranches();

    const socket = getSocket();
    socket.emit("subscribeAdmin");
    socket.on("connect", () => socket.emit("subscribeAdmin"));
    socket.on("bootstrap", (payload: { menus: Menu[] }) => {
      if (payload?.menus) setMenus(payload.menus);
    });
    socket.on("menusUpdated", (next: Menu[]) => setMenus(next));

    return () => {
      socket.off("connect");
      socket.off("bootstrap");
      socket.off("menusUpdated");
    };
  }, []);

  const doAddBranch = async (name: string) => {
    setBranchUi((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add branch");
      }
      setBranchUi((prev) => {
        const next = prev.branches.includes(name)
          ? prev.branches
          : [...prev.branches, name].sort((a, b) => a.localeCompare(b));
        return {
          ...prev,
          branches: next,
          newBranchName: "",
          saving: false,
          error: null,
        };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add branch";
      setBranchUi((prev) => ({ ...prev, saving: false, error: msg }));
    }
  };

  const requestAddBranch = () => {
    const name = branchUi.newBranchName.trim();
    if (!name) {
      setBranchUi((prev) => ({ ...prev, error: "Branch name is required" }));
      return;
    }
    setBranchConfirm({ open: true, action: "add", name });
  };

  const doRemoveBranch = async (name: string) => {
    if (menuForm.branch === name) {
      setMenuForm((prev) => ({ ...prev, branch: "" }));
    }
    setBranchUi((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const res = await fetch(`/api/branches/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to remove branch");
      }
      setBranchUi((prev) => ({
        ...prev,
        branches: prev.branches.filter((b) => b !== name),
        saving: false,
        error: null,
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to remove branch";
      setBranchUi((prev) => ({ ...prev, saving: false, error: msg }));
    }
  };

  const requestRemoveBranch = (name: string) => {
    setBranchConfirm({ open: true, action: "delete", name });
  };

  useEffect(() => {
    return () => {
      menuForm.imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [menuForm.imagePreviews]);

  const handleMenuSubmit = async () => {
    if (!menuForm.name.trim()) {
      setMenuError("Menu name is required");
      return;
    }
    if (!menuForm.branch) {
      setMenuError("Please select a branch");
      return;
    }
    if (!editingMenuId && menuForm.imageFiles.length === 0) {
      setMenuError("Please upload at least one menu image");
      return;
    }
    setMenuError(null);

    setCreatingMenu(true);
    try {
      let imageUrls: string[] | undefined = editingMenuImageUrls ?? undefined;

      if (menuForm.imageFiles.length > 0) {
        const fd = new FormData();
        menuForm.imageFiles.forEach((file) => {
          fd.append("files", file);
        });
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to upload images");
        }
        const uploadData = await uploadRes.json();
        imageUrls = uploadData.urls;
      }

      const payload = {
        name: menuForm.name,
        type: "image" as MenuType,
        branch: menuForm.branch,
        imageUrls,
      };

      const res = await fetch(
        editingMenuId ? `/api/menus/${editingMenuId}` : "/api/menus",
        {
          method: editingMenuId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error ?? (editingMenuId ? "Failed to update menu" : "Failed to save menu")
        );
      }
      const data = await res.json().catch(() => ({}));
      if (data.menu) {
        setMenus((prev) => {
          const filtered = prev.filter((m) => m.id !== data.menu.id);
          return [data.menu, ...filtered];
        });
      }

      menuForm.imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setMenuForm({
        name: "",
        branch: "",
        imageFiles: [],
        imagePreviews: [],
      });
      setEditingMenuId(null);
      setEditingMenuImageUrls(null);
      setIsMenuFormOpen(false);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : editingMenuId
            ? "Failed to update menu"
            : "Failed to create menu";
      setMenuError(msg);
    } finally {
      setCreatingMenu(false);
    }
  };

  const beginEditMenu = (menu: Menu) => {
    menuForm.imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setEditingMenuId(menu.id);
    setEditingMenuImageUrls(menu.imageUrls ?? []);
    setMenuError(null);
    setMenuForm({
      name: menu.name,
      branch: menu.branch,
      imageFiles: [],
      imagePreviews: [],
    });
    setIsMenuFormOpen(true);
  };

  const cancelEditMenu = () => {
    menuForm.imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setEditingMenuId(null);
    setEditingMenuImageUrls(null);
    setMenuError(null);
    setMenuForm({
      name: "",
      branch: "",
      imageFiles: [],
      imagePreviews: [],
    });
    setIsMenuFormOpen(false);
  };

  const beginCreateMenu = () => {
    if (editingMenuId) cancelEditMenu();
    setMenuError(null);
    setIsMenuFormOpen(true);
  };

  const doDeleteMenu = async (menuId: string) => {
    setCreatingMenu(true);
    setMenuError(null);
    try {
      const res = await fetch(`/api/menus/${menuId}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to delete menu");
      }
      setMenus((prev) => prev.filter((m) => m.id !== menuId));
      if (editingMenuId === menuId) {
        cancelEditMenu();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete menu";
      setMenuError(msg);
    } finally {
      setCreatingMenu(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-6 border-b border-slate-200 bg-slate-50/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-slate-50/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Menu</h1>
            <p className="text-sm text-slate-600">Create and manage menu boards.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-80">
              <input
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder="Search menus or branches…"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
              />
            </div>

            <select
              value={menuBranchFilter}
              onChange={(e) => setMenuBranchFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40 sm:w-56"
            >
              <option value="all">All branches</option>
              {branchUi.branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={beginCreateMenu}
              aria-label="Create a menu"
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
                Create a menu
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Menus</h2>
              <span className="text-xs text-slate-500">
                {filteredMenus.length} item{filteredMenus.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="mt-4">
              {filteredMenus.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">No menus found</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {menus.length === 0
                      ? "Create your first menu to get started."
                      : "Try adjusting your search or branch filter."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredMenus.map((menu) => (
                    <div
                      key={menu.id}
                      className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                            {menu.branch}
                          </p>
                          <h3 className="text-lg font-semibold text-slate-900">{menu.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            Updated {new Date(menu.updatedAt).toLocaleTimeString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => beginEditMenu(menu)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setMenuConfirm({
                                open: true,
                                menuId: menu.id,
                                menuName: menu.name,
                              })
                            }
                            className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {menu.imageUrls && menu.imageUrls.length > 0 && (
                        <div className="mt-3">
                          <div className="grid grid-cols-2 gap-2">
                            {menu.imageUrls.slice(0, 4).map((url) => (
                              <img
                                key={url}
                                src={url}
                                alt={selectedMenuById.get(menu.id)?.name ?? menu.name}
                                className="h-32 w-full rounded-xl object-cover ring-1 ring-slate-100"
                              />
                            ))}
                          </div>
                          {menu.imageUrls.length > 4 && (
                            <p className="mt-2 text-xs text-slate-500">
                              + {menu.imageUrls.length - 4} more image
                              {menu.imageUrls.length - 4 !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {isMenuFormOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            disabled={creatingMenu}
            onClick={cancelEditMenu}
            className="absolute inset-0 bg-black/40"
          />

          <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingMenuId ? "Edit menu" : "Create a menu"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {editingMenuId
                    ? "Update menu details and optionally upload new images."
                    : "Enter menu details and upload at least one image."}
                </p>
              </div>
              <button
                type="button"
                onClick={cancelEditMenu}
                disabled={creatingMenu}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Menu name
                <input
                  value={menuForm.name}
                  onChange={(e) =>
                    setMenuForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Breakfast Board"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Branch
                <div className="flex gap-2">
                  <select
                    value={menuForm.branch}
                    onChange={(e) =>
                      setMenuForm((prev) => ({ ...prev, branch: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
                  >
                    <option value="">Select a branch</option>
                    {branchUi.branches.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setBranchUi((prev) => ({ ...prev, editing: true, error: null }))
                    }
                    className="shrink-0 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Upload menu images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    const previews = files.map((file) => URL.createObjectURL(file));
                    setMenuForm((prev) => ({
                      ...prev,
                      imageFiles: [...prev.imageFiles, ...files],
                      imagePreviews: [...prev.imagePreviews, ...previews],
                    }));
                    e.currentTarget.value = "";
                  }}
                  className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3 text-sm shadow-sm outline-none hover:bg-slate-100/70 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
                />
                {editingMenuId && menuForm.imagePreviews.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Leave empty to keep existing images.
                  </p>
                )}
                {menuForm.imagePreviews.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {menuForm.imagePreviews.map((preview, idx) => (
                      <div key={preview} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          className="h-28 w-full rounded-xl object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            URL.revokeObjectURL(preview);
                            setMenuForm((prev) => ({
                              ...prev,
                              imageFiles: prev.imageFiles.filter((_, i) => i !== idx),
                              imagePreviews: prev.imagePreviews.filter((_, i) => i !== idx),
                            }));
                          }}
                          className="absolute right-1 top-1 rounded-full bg-red-500 px-2 py-1 text-xs font-semibold text-white shadow-sm hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </label>

              {menuError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {menuError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={creatingMenu}
                  onClick={cancelEditMenu}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  disabled={creatingMenu}
                  onClick={handleMenuSubmit}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {creatingMenu
                    ? "Saving..."
                    : editingMenuId
                      ? "Update menu"
                      : "Save menu"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {branchUi.editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            disabled={branchUi.saving}
            onClick={() =>
              setBranchUi((prev) => ({
                ...prev,
                editing: false,
                error: null,
                newBranchName: "",
              }))
            }
            className="absolute inset-0 bg-black/40"
          />

          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit branches</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Add or delete branches used in the menu dropdown.
                </p>
              </div>
              <button
                type="button"
                disabled={branchUi.saving}
                onClick={() =>
                  setBranchUi((prev) => ({
                    ...prev,
                    editing: false,
                    error: null,
                    newBranchName: "",
                  }))
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex gap-2">
                <input
                  value={branchUi.newBranchName}
                  onChange={(e) =>
                    setBranchUi((prev) => ({ ...prev, newBranchName: e.target.value }))
                  }
                  placeholder="New branch name"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-200/40"
                />
                <button
                  type="button"
                  disabled={branchUi.saving}
                  onClick={requestAddBranch}
                  className="shrink-0 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {branchUi.saving ? "Saving..." : "Add"}
                </button>
              </div>

              {branchUi.error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {branchUi.error}
                </p>
              )}

              <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                {branchUi.branches.length === 0 ? (
                  <div className="p-4 text-sm text-slate-600">No branches found.</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {branchUi.branches.map((name) => (
                      <div key={name} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {name}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={branchUi.saving}
                          onClick={() => requestRemoveBranch(name)}
                          className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {branchConfirm.open && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            disabled={branchUi.saving}
            onClick={() => setBranchConfirm({ open: false })}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {branchConfirm.action === "add" ? "Add branch" : "Delete branch"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {branchConfirm.action === "add"
                ? `Add "${branchConfirm.name}" to branches?`
                : `Delete "${branchConfirm.name}" from branches?`}
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={branchUi.saving}
                onClick={() => setBranchConfirm({ open: false })}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={branchUi.saving}
                onClick={async () => {
                  const { action, name } = branchConfirm;
                  setBranchConfirm({ open: false });
                  if (action === "add") await doAddBranch(name);
                  if (action === "delete") await doRemoveBranch(name);
                }}
                className={
                  branchConfirm.action === "add"
                    ? "rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-60"
                    : "rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
                }
              >
                {branchUi.saving
                  ? "Working..."
                  : branchConfirm.action === "add"
                    ? "Add"
                    : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {menuConfirm.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            disabled={creatingMenu}
            onClick={() => setMenuConfirm({ open: false })}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete menu</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete "{menuConfirm.menuName}"?
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={creatingMenu}
                onClick={() => setMenuConfirm({ open: false })}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creatingMenu}
                onClick={async () => {
                  const id = menuConfirm.menuId;
                  setMenuConfirm({ open: false });
                  await doDeleteMenu(id);
                }}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
              >
                {creatingMenu ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
