"use client";

import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import type { Display, Menu, MenuType } from "@/lib/types";

type MenuFormState = {
  name: string;
  branch: string;
  imageFiles: File[];
  imagePreviews: string[];
};

const BRANCHES = ["Ateneo", "Mapua", "Lasalle", "UP", "UST"];

export default function Home() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [displays, setDisplays] = useState<Display[]>([]);
  const [creatingMenu, setCreatingMenu] = useState(false);
  const [creatingDisplay, setCreatingDisplay] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [displayError, setDisplayError] = useState<string | null>(null);
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

  useEffect(() => {
    const loadInitial = async () => {
      const [menuRes, displayRes] = await Promise.all([
        fetch("/api/menus"),
        fetch("/api/displays"),
      ]);
      const menuData = await menuRes.json();
      const displayData = await displayRes.json();
      setMenus(menuData.menus ?? []);
      setDisplays(displayData.displays ?? []);
    };
    loadInitial();

    const socket = getSocket();
    socket.emit("subscribeAdmin");
    socket.on("connect", () => socket.emit("subscribeAdmin"));
    socket.on("bootstrap", (payload: { menus: Menu[]; displays: Display[] }) => {
      setMenus(payload.menus);
      setDisplays(payload.displays);
    });
    socket.on("menusUpdated", (next: Menu[]) => setMenus(next));
    socket.on("displaysUpdated", (next: Display[]) => setDisplays(next));

    return () => {
      socket.off("connect");
      socket.off("bootstrap");
      socket.off("menusUpdated");
      socket.off("displaysUpdated");
      socket.disconnect();
    };
  }, []);

  const refreshDisplays = async () => {
    const res = await fetch("/api/displays");
    if (!res.ok) return;
    const data = await res.json();
    setDisplays(data.displays ?? []);
  };

  const handleMenuSubmit = async () => {
    if (!menuForm.name.trim()) {
      setMenuError("Menu name is required");
      return;
    }
    if (!menuForm.branch) {
      setMenuError("Please select a branch");
      return;
    }
    if (menuForm.imageFiles.length === 0) {
      setMenuError("Please upload at least one menu image");
      return;
    }
    setMenuError(null);

    setCreatingMenu(true);
    try {
      const fd = new FormData();
      menuForm.imageFiles.forEach((file) => {
        fd.append("files", file);
      });
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const uploadData = await uploadRes.json();
      const imageUrls = uploadData.urls;

      const payload = {
        name: menuForm.name,
        type: "image" as MenuType,
        branch: menuForm.branch,
        imageUrls,
      };

      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save menu");
      }
      const data = await res.json();
      if (data.menu) {
        setMenus((prev) => {
          const filtered = prev.filter((m) => m.id !== data.menu.id);
          return [data.menu, ...filtered];
        });
      }
      // Clean up object URLs
      menuForm.imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setMenuForm({
        name: "",
        branch: "",
        imageFiles: [],
        imagePreviews: [],
      });
    } finally {
      setCreatingMenu(false);
    }
  };

  const handleCreateDisplay = async (nameInput: string) => {
    if (!nameInput.trim()) {
      setDisplayError("Display name is required");
      return;
    }
    setDisplayError(null);
    setCreatingDisplay(true);
    try {
      const res = await fetch("/api/displays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to add display");
      }
      const data = await res.json();
      if (data.display) {
        setDisplays((prev) => [data.display, ...prev]);
      }
      await refreshDisplays(); // ensure we stay in sync with server IDs
    } finally {
      setCreatingDisplay(false);
    }
  };

  const handleAssignMenu = async (displayId: string, menuId?: string) => {
    setDisplayError(null);
    const res = await fetch(`/api/displays/${displayId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuId: menuId || null }),
    });
    if (!res.ok) {
      if (res.status === 404) {
        await refreshDisplays();
        setDisplayError(
          "Display not found (server reset). List refreshed—select a display again."
        );
        return;
      }
      const err = await res.json().catch(() => ({}));
      setDisplayError(err.error ?? "Failed to assign menu");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.display) {
      setDisplays((prev) =>
        prev.map((d) => (d.id === data.display.id ? data.display : d))
      );
    } else {
      await refreshDisplays();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Digital Menu System
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-3">
        <section className="col-span-2 space-y-6">
          <Card title="Create a menu">
            <div className="mt-4 space-y-4">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Menu name
                <input
                  value={menuForm.name}
                  onChange={(e) =>
                    setMenuForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Breakfast Board"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Branch
                <select
                  value={menuForm.branch}
                  onChange={(e) =>
                    setMenuForm((prev) => ({ ...prev, branch: e.target.value }))
                  }
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="">Select a branch</option>
                  {BRANCHES.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
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
                  }}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none"
                />
                {menuForm.imagePreviews.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {menuForm.imagePreviews.map((preview, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={preview}
                          alt={`Preview ${idx + 1}`}
                          className="h-32 w-full rounded-md object-cover"
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

              <div className="flex justify-end">
                <button
                  disabled={creatingMenu}
                  onClick={handleMenuSubmit}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {creatingMenu ? "Saving..." : "Save menu"}
                </button>
              </div>
            </div>
          </Card>

          <Card title="Menus">
            {menuError && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {menuError}
              </p>
            )}
            {menus.length === 0 ? (
              <p className="text-sm text-slate-500">
                No menus yet. Create one to get started.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {menus.map((menu) => (
                  <div
                    key={menu.id}
                    className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-slate-500">
                          {menu.branch}
                        </p>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {menu.name}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500">
                        Updated {new Date(menu.updatedAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {menu.imageUrls && menu.imageUrls.length > 0 && (
                      <div className="mt-3">
                        <div className="grid grid-cols-2 gap-2">
                          {menu.imageUrls.slice(0, 4).map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`${menu.name} ${idx + 1}`}
                              className="h-32 w-full rounded-md object-cover"
                            />
                          ))}
                        </div>
                        {menu.imageUrls.length > 4 && (
                          <p className="mt-2 text-xs text-slate-500">
                            + {menu.imageUrls.length - 4} more image{menu.imageUrls.length - 4 !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section className="space-y-6">
          <Card title="Displays">
            <DisplayCreator onCreate={handleCreateDisplay} loading={creatingDisplay} />
            {displayError && (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {displayError}
              </p>
            )}
            <div className="mt-4 space-y-3">
              {displays.map((display) => (
                <div
                  key={display.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Screen
                      </p>
                      <h3 className="text-base font-semibold text-slate-900">
                        {display.name}
                      </h3>
                      <p className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                        <span
                          className={`h-2 w-2 rounded-full ${display.online ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                        />
                        {display.online ? "Online" : "Offline"}
                        {display.lastSeen && (
                          <span className="text-slate-400">
                            • Last seen {formatLastSeen(display.lastSeen)}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Updated {new Date(display.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <label className="mt-3 flex flex-col gap-2 text-xs font-medium text-slate-600">
                    Assigned menu
                    <select
                      value={display.menuId ?? ""}
                      onChange={(e) =>
                        handleAssignMenu(display.id, e.target.value || undefined)
                      }
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                    >
                      <option value="">— No menu —</option>
                      {menus.map((menu) => (
                        <option key={menu.id} value={menu.id}>
                          {menu.branch} - {menu.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-700">
                      Menu:{" "}
                      {display.menuId
                        ? selectedMenuById.get(display.menuId)?.name ??
                        "Not found"
                        : "Unassigned"}
                    </span>
                    <CopyLinkButton displayId={display.id} />
                  </div>
                </div>
              ))}
              {displays.length === 0 && (
                <p className="text-sm text-slate-500">
                  Add your first display to get a shareable screen link.
                </p>
              )}
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none"
      />
    </label>
  );
}

function DisplayCreator({
  onCreate,
  loading,
}: {
  onCreate: (name: string) => void;
  loading: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
        Screen name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Lobby, Patio, Drive-thru"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-slate-400 focus:outline-none"
        />
      </label>
      <div className="mt-3 flex justify-end">
        <button
          disabled={loading}
          onClick={() => {
            if (!name) return;
            onCreate(name);
            setName("");
          }}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Adding..." : "Add display"}
        </button>
      </div>
    </div>
  );
}

function CopyLinkButton({ displayId }: { displayId: string }) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/display/${displayId}`
      : `/display/${displayId}`;

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-slate-300"
    >
      {copied ? "Copied!" : "Copy display link"}
    </button>
  );
}

function formatLastSeen(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
