import { NextRequest, NextResponse } from "next/server";
import {
  getDisplayWithMenu,
  hydrateDisplays,
  hydrateMenus,
  updateDisplay,
} from "@/lib/store";
import { getMongoDb } from "@/lib/mongodb";
import { Display } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const db = await getMongoDb();
  const [displaysFromDb, menusFromDb] = await Promise.all([
    db.collection("displays").find({}, { projection: { _id: 0 } }).toArray(),
    db.collection("menus").find({}, { projection: { _id: 0 } }).toArray(),
  ]);
  hydrateDisplays(displaysFromDb as any);
  hydrateMenus(menusFromDb as any);

  const display = getDisplayWithMenu(id);
  if (!display) {
    return NextResponse.json({ error: "Display not found" }, { status: 404 });
  }
  return NextResponse.json({ display });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = (await request.json()) as Partial<{
    menuId: string | null;
    name?: string;
  }>;

  // Convert null to undefined for menuId to match Display type
  const updatePayload: Partial<Omit<Display, "id">> = {
    ...payload,
    menuId: payload.menuId === null ? undefined : payload.menuId,
  };

  const updated = updateDisplay(id, updatePayload);

  if (!updated) {
    return NextResponse.json({ error: "Display not found" }, { status: 404 });
  }

  const db = await getMongoDb();
  await db.collection("displays").updateOne(
    { id: updated.id },
    {
      $set: {
        id: updated.id,
        name: updated.name,
        menuId: updated.menuId,
        updatedAt: updated.updatedAt,
        online: updated.online,
        lastSeen: updated.lastSeen,
      },
    },
    { upsert: true }
  );
  return NextResponse.json({ display: updated });
}

