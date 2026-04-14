import { NextRequest, NextResponse } from "next/server";
import { createDisplayWithId, hydrateDisplays, listDisplays } from "@/lib/store";
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
    branch?: string;
  };

  if (!payload.name || !payload.branch) {
    return NextResponse.json(
      { error: "name and branch are required" },
      { status: 400 }
    );
  }

  const db = await getMongoDb();

  const counterRes = await db.collection("counters").findOneAndUpdate(
    { _id: "displayId" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  const nextId = String((counterRes.value as any)?.seq ?? 1);

  const display = createDisplayWithId(nextId, payload.name, payload.branch);

  await db.collection("displays").updateOne(
    { id: display.id },
    {
      $set: {
        id: display.id,
        name: display.name,
        branch: display.branch,
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
