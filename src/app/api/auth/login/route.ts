import { NextRequest, NextResponse } from "next/server";
import {
  createSessionTokenSigned,
  getSessionCookieName,
  type SessionPayload,
} from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

type UserDoc = {
  username: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
};

export async function POST(request: NextRequest) {
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

  const db = await getMongoDb();
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne(
    { username },
    { projection: { _id: 0, username: 1, passwordSalt: 1, passwordHash: 1 } }
  );

  if (
    !user ||
    !verifyPassword(password, {
      salt: user.passwordSalt,
      hash: user.passwordHash,
    })
  ) {
    return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  }

  const payload: SessionPayload = {
    sub: username,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };

  const token = await createSessionTokenSigned(payload);
  const res = NextResponse.json({ ok: true });

  res.cookies.set({
    name: getSessionCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return res;
}
