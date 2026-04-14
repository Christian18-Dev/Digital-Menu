import { NextRequest, NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name).trim();

  if (!decodedName) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const db = await getMongoDb();
  const collection = db.collection("branches");

  const result = await collection.deleteOne({ name: decodedName });
  const ok = result.deletedCount > 0;

  if (!ok) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
