import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files");

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "at least one file is required" }, { status: 400 });
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const urls: string[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = path.extname(file.name) || ".png";
    const fileName = `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}${ext}`;
    const target = path.join(uploadDir, fileName);

    await fs.writeFile(target, buffer);
    urls.push(`/uploads/${fileName}`);
  }

  return NextResponse.json({ urls });
}

