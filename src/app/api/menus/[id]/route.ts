import { NextRequest, NextResponse } from "next/server";
import { deleteMenu, getMenu, updateMenu } from "@/lib/store";
import type { MenuType } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  return NextResponse.json({ menu: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = deleteMenu(id);
  if (!ok) {
    return NextResponse.json({ error: "Menu not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

