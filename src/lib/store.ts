import { randomUUID } from "crypto";
import type {
  BroadcastEvent,
  Display,
  DisplayWithMenu,
  Menu,
  MenuType,
} from "./types";

type Subscriber = (event: BroadcastEvent) => void;

const menus = new Map<string, Menu>();
const displays = new Map<string, Display>();
const subscribers = new Set<Subscriber>();

const notify = (event: BroadcastEvent) => {
  subscribers.forEach((fn) => fn(event));
};

export const subscribeToStore = (fn: Subscriber) => {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
};

export const listMenus = () => Array.from(menus.values());

export const listDisplays = () => Array.from(displays.values());

export const getMenu = (id: string) => menus.get(id);

export const getDisplay = (id: string) => displays.get(id);

export const getDisplayWithMenu = (id: string): DisplayWithMenu | undefined => {
  const display = displays.get(id);
  if (!display) return undefined;
  const menu = display.menuId ? menus.get(display.menuId) : undefined;
  return { ...display, menu };
};

export const createMenu = (
  input: Omit<Menu, "id" | "updatedAt"> & { id?: string }
): Menu => {
  const id = input.id ?? randomUUID();
  const now = Date.now();
  const menu: Menu = {
    id,
    name: input.name,
    type: "image",
    branch: input.branch,
    imageUrls: input.imageUrls,
    updatedAt: now,
  };
  menus.set(id, menu);
  notify({ type: "menus-changed" });
  return menu;
};

export const updateMenu = (
  id: string,
  input: Partial<Omit<Menu, "id">>
): Menu | undefined => {
  const existing = menus.get(id);
  if (!existing) return undefined;
  const next: Menu = {
    ...existing,
    ...input,
    type: "image",
    updatedAt: Date.now(),
  };
  menus.set(id, next);
  notify({ type: "menus-changed" });
  // notify displays that point to this menu
  Array.from(displays.values())
    .filter((d) => d.menuId === id)
    .forEach((display) =>
      notify({ type: "display-menu-changed", displayId: display.id })
    );
  return next;
};

export const deleteMenu = (id: string) => {
  const existed = menus.delete(id);
  if (!existed) return false;
  // Clear menu assignment for displays that used it
  Array.from(displays.values())
    .filter((d) => d.menuId === id)
    .forEach((d) => {
      displays.set(d.id, { ...d, menuId: undefined, updatedAt: Date.now() });
      notify({ type: "display-menu-changed", displayId: d.id });
    });
  notify({ type: "menus-changed" });
  notify({ type: "displays-changed" });
  return true;
};

export const createDisplay = (name: string): Display => {
  const display: Display = {
    id: randomUUID(),
    name,
    updatedAt: Date.now(),
    online: false,
    lastSeen: undefined,
  };
  displays.set(display.id, display);
  notify({ type: "displays-changed" });
  return display;
};

export const updateDisplay = (
  id: string,
  input: Partial<Omit<Display, "id">>
): Display | undefined => {
  const existing = displays.get(id);
  if (!existing) return undefined;
  const next: Display = { ...existing, ...input, updatedAt: Date.now() };
  displays.set(id, next);
  notify({ type: "displays-changed" });
  if (input.menuId !== undefined) {
    notify({ type: "display-menu-changed", displayId: id });
  }
  return next;
};

export const setDisplayOnline = (id: string) => {
  const existing = displays.get(id);
  if (!existing) return;
  const next: Display = {
    ...existing,
    online: true,
    lastSeen: Date.now(),
    updatedAt: Date.now(),
  };
  displays.set(id, next);
  notify({ type: "displays-changed" });
};

export const setDisplayOffline = (id: string) => {
  const existing = displays.get(id);
  if (!existing) return;
  const next: Display = {
    ...existing,
    online: false,
    updatedAt: Date.now(),
  };
  displays.set(id, next);
  notify({ type: "displays-changed" });
};

export const heartbeatDisplay = (id: string) => {
  const existing = displays.get(id);
  if (!existing) return;
  const next: Display = {
    ...existing,
    online: true,
    lastSeen: Date.now(),
  };
  displays.set(id, next);
  // No notify to reduce chatter; rely on periodic setDisplayOnline on subscribe
};

// Seed a default display for quick start
(() => {
  const displayId = "lobby-screen";
  displays.set(displayId, {
    id: displayId,
    name: "Lobby Screen",
    updatedAt: Date.now(),
    online: false,
    lastSeen: undefined,
  });
})();

export const upsertMenuFromPayload = (payload: {
  id?: string;
  name: string;
  type: MenuType;
  branch: string;
  imageUrls?: string[];
}) => {
  if (payload.id && menus.has(payload.id)) {
    return updateMenu(payload.id, {
      name: payload.name,
      branch: payload.branch,
      imageUrls: payload.imageUrls,
    });
  }
  return createMenu({
    id: payload.id,
    name: payload.name,
    type: payload.type,
    branch: payload.branch,
    imageUrls: payload.imageUrls,
  });
};

