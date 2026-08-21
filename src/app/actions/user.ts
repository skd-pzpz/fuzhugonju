"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateUserProfile(data: {
  name?: string;
  image?: string;
  theme?: string;
  mode?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");

  const updates: Record<string, string> = {};
  if (data.name?.trim()) updates.name = data.name.trim();
  if (data.image !== undefined) updates.image = data.image;
  if (data.theme) updates.theme = data.theme;
  if (data.mode) updates.mode = data.mode;

  await db.update(users).set(updates).where(eq(users.id, session.user.id));

  revalidatePath("/workspace/settings");
  return { success: true };
}

export async function uploadAvatar(base64Image: string) {
  // 限制 2MB
  if (base64Image.length > 2 * 1024 * 1024 * 1.37) {
    throw new Error("图片过大，请压缩至 2MB 以内");
  }
  return updateUserProfile({ image: base64Image });
}

export async function getUserProfile() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id),
    columns: {
      id: true,
      name: true,
      username: true,
      image: true,
      theme: true,
      mode: true,
    },
  });

  return user;
}
