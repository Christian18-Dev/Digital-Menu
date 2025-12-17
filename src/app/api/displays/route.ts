import { NextRequest, NextResponse } from "next/server";
import { listDisplays, createDisplay } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
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

  return NextResponse.json({ display });
}

