import { NextRequest, NextResponse } from "next/server";
import { createDisplay, hydrateDisplays, listDisplays } from "@/lib/store";
import { getMongoDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function GET() {
  const db = await getMongoDb();
  const displaysCollection = db.collection("displays");
  let displaysFromDb = await displaysCollection
    .find({}, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .toArray();

  hydrateDisplays(displaysFromDb as any);
  return NextResponse.json({ displays: listDisplays() });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as {
    name?: string;
  };

  if (!payload.name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  const display = createDisplay(payload.name);

  const db = await getMongoDb();
  await db.collection("displays").updateOne(
    { id: display.id },
    {
      $set: {
        id: display.id,
        name: display.name,
        menuId: display.menuId,
        updatedAt: display.updatedAt,
        online: display.online,
        lastSeen: display.lastSeen,
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ display });
}
