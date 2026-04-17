export type MenuType = "image";

export type Menu = {
  id: string;
  name: string;
  type: MenuType;
  branch?: string;
  imageUrls?: string[];
  updatedAt: number;
};

export type Display = {
  id: string;
  name: string;
  branch: string;
  menuId?: string;
  menuIds?: string[];
  updatedAt: number;
  online?: boolean;
  lastSeen?: number;
};

export type DisplayWithMenu = Display & { menu?: Menu; menus?: Menu[] };

export type BroadcastEvent =
  | { type: "menus-changed" }
  | { type: "displays-changed" }
  | { type: "display-menu-changed"; displayId: string };

