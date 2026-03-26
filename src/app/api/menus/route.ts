import { NextRequest, NextResponse } from "next/server";
import { hydrateMenus, listMenus, upsertMenuFromPayload } from "@/lib/store";
import { getMongoDb } from "@/lib/mongodb";
import type { MenuType } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const db = await getMongoDb();
  const menusFromDb = await db
    .collection("menus")
    .find({}, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();

  hydrateMenus(menusFromDb as any);
  return NextResponse.json({ menus: listMenus() });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    name?: string;
    type?: MenuType;
    branch?: string;
    imageUrls?: string[];
  };

  if (!payload.name || !payload.type || !payload.branch) {
    return NextResponse.json(
      { error: "name, type, and branch are required" },
      { status: 400 }
    );
  }

  const menu = upsertMenuFromPayload({
    name: payload.name,
    type: payload.type,
    branch: payload.branch,
    imageUrls: payload.imageUrls,
  });

  if (!menu) {
    return NextResponse.json({ error: "Failed to save menu" }, { status: 500 });
  }

  const db = await getMongoDb();
  await db.collection("menus").updateOne(
    { id: menu.id },
    {
      $set: {
        id: menu.id,
        name: menu.name,
        type: menu.type,
        branch: menu.branch,
        imageUrls: menu.imageUrls,
        updatedAt: menu.updatedAt,
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ menu });
}
