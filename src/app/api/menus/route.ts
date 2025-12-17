import { NextRequest, NextResponse } from "next/server";
import { listMenus, upsertMenuFromPayload } from "@/lib/store";
import type { MenuType } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
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

  return NextResponse.json({ menu });
}

