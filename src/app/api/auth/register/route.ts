import { NextRequest, NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

type UserDoc = {
  username: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
};

async function hasAnyUser() {
  const db = await getMongoDb();
  const users = db.collection<UserDoc>("users");
  const count = await users.countDocuments({}, { limit: 1 });
  return count > 0;
}

export async function GET() {
  const allowed = !(await hasAnyUser());
  return NextResponse.json({ allowed });
}

export async function POST(request: NextRequest) {
  if (await hasAnyUser()) {
    return NextResponse.json(
      { error: "registration is disabled" },
      { status: 403 }
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { username?: string; password?: string }
    | null;

  const username = body?.username?.trim();
  const password = body?.password;

  if (!username || !password) {
    return NextResponse.json(
      { error: "username and password are required" },
      { status: 400 }
    );
  }

  if (username.length < 3) {
    return NextResponse.json(
      { error: "username must be at least 3 characters" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = await getMongoDb();
  const users = db.collection<UserDoc>("users");

  const existing = await users.findOne({ username }, { projection: { _id: 1 } });
  if (existing) {
    return NextResponse.json(
      { error: "username already exists" },
      { status: 409 }
    );
  }

  const { salt, hash } = hashPassword(password);
  const doc: UserDoc = {
    username,
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };

  await users.insertOne(doc as any);

  return NextResponse.json({ ok: true });
}
