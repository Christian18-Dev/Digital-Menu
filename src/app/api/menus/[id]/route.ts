import { NextRequest, NextResponse } from "next/server";
import { deleteMenu, getMenu, hydrateMenus, updateMenu } from "@/lib/store";
import { getMongoDb } from "@/lib/mongodb";
import type { MenuType } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getMongoDb();
  const menusFromDb = await db
    .collection("menus")
    .find({}, { projection: { _id: 0 } })
    .toArray();
  hydrateMenus(menusFromDb as any);

  const menu = getMenu(id);
  if (!menu) {
    return NextResponse.json({ error: "Menu not found" }, { status: 404 });
  }
  return NextResponse.json({ menu });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payload = (await request.json()) as Partial<{
    name: string;
    type: MenuType;
    branch: string;
    imageUrls: string[];
  }>;

  const updated = updateMenu(id, payload);

  if (!updated) {
    return NextResponse.json({ error: "Menu not found" }, { status: 404 });
  }

  const db = await getMongoDb();
  await db.collection("menus").updateOne(
    { id: updated.id },
    {
      $set: {
        id: updated.id,
        name: updated.name,
        type: updated.type,
        branch: updated.branch,
        imageUrls: updated.imageUrls,
        updatedAt: updated.updatedAt,
      },
    },
    { upsert: true }
  );
  return NextResponse.json({ menu: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = await getMongoDb();
  const deleteResult = await db.collection("menus").deleteOne({ id });
  const ok = deleteResult.deletedCount > 0;

  // Keep in-memory store in sync
  deleteMenu(id);
  if (!ok) {
    return NextResponse.json({ error: "Menu not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
