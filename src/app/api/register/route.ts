﻿import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || username.length < 3) {
      return NextResponse.json({ ok: false, error: "用户名至少 3 个字符" }, { status: 400 });
    }

    if (username.length > 20) {
      return NextResponse.json({ ok: false, error: "用户名不能超过 20 个字符" }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
      return NextResponse.json({ ok: false, error: "用户名只能包含字母、数字、下划线和中文" }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ ok: false, error: "密码至少 6 位" }, { status: 400 });
    }

    if (password.length > 128) {
      return NextResponse.json({ ok: false, error: "密码不能超过 128 位" }, { status: 400 });
    }

    // 检查用户名是否已存在
    const existing = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existing) {
      return NextResponse.json({ ok: false, error: "该用户名已被占用" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    await db
      .insert(users)
      .values({
        username,
        name: username,
        passwordHash,
      });

    return NextResponse.json({ ok: true, message: "注册成功" });
  } catch (error: any) {
    console.error("注册失败:", error);

    if (error?.code === "23505") {
      return NextResponse.json({ ok: false, error: "该用户名已被占用" }, { status: 409 });
    }

    const msg = process.env.NODE_ENV === "development"
      ? `注册失败: ${error?.message || "未知错误"}`
      : "注册失败，请稍后重试";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
