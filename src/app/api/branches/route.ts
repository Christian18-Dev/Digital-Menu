import { NextRequest, NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";

export const runtime = "nodejs";

const DEFAULT_BRANCHES = ["Ateneo", "Mapua", "Lasalle", "UP", "UST"];

type BranchDoc = {
  name: string;
  updatedAt: number;
};

export async function GET() {
  const db = await getMongoDb();
  const collection = db.collection<BranchDoc>("branches");

  const count = await collection.countDocuments();
  if (count === 0) {
    await collection.insertMany(
      DEFAULT_BRANCHES.map((name) => ({ name, updatedAt: Date.now() })),
      { ordered: false }
    );
  }

  const docs = await collection
    .find({}, { projection: { _id: 0 } })
    .sort({ name: 1 })
    .toArray();

  const branches = docs
    .map((d) => d.name)
    .filter((name): name is string => typeof name === "string" && !!name)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  return NextResponse.json({ branches });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { name?: string };
  const name = payload.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const db = await getMongoDb();
  const collection = db.collection("branches");

  const existing = await collection.findOne({ name }, { projection: { _id: 0 } });
  if (existing) {
    return NextResponse.json({ branch: name });
  }

  await collection.insertOne({ name, updatedAt: Date.now() });
  return NextResponse.json({ branch: name });
}
