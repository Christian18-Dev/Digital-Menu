import { NextRequest, NextResponse } from "next/server";
import { getDisplay, getDisplayWithMenu, updateDisplay } from "@/lib/store";
import { Display } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  return NextResponse.json({ display: updated });
}

