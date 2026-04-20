import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadBufferToCloudinary = async (
  buffer: Buffer,
  fileName: string
): Promise<string> => {
  return await new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "digital-menu",
        resource_type: "image",
        public_id: fileName,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve(result.secure_url);
      }
    );

    upload.end(buffer);
  });
};

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files");

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "at least one file is required" }, { status: 400 });
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return NextResponse.json(
      {
        error:
          "Cloudinary env vars are missing (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)",
      },
      { status: 500 }
    );
  }

  const urls: string[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const baseName = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const original = (file.name || "image").replace(/\.[^/.]+$/, "");
    const safeOriginal = original
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);
    const publicId = `${safeOriginal || "menu"}-${baseName}`;

    const url = await uploadBufferToCloudinary(buffer, publicId);
    urls.push(url);
  }

  return NextResponse.json({ urls });
}

