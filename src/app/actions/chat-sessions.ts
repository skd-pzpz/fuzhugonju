"use server";

import { and, desc, eq } from "drizzle-orm";

import { chatSessions } from "@/db/schema";
import { db } from "@/db";

export type ChatSession = {
  id: string;
  title: string;
  mode: string;
  messages: unknown[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 获取所有会话列表（不含消息内容，用于侧边栏展示）
 */
export async function listChatSessions(): Promise<
  Omit<ChatSession, "messages">[]
> {
  const sessions = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      mode: chatSessions.mode,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .orderBy(desc(chatSessions.updatedAt));

  return sessions;
}

/**
 * 获取单个会话（含消息内容）
 */
export async function getChatSession(
  sessionId: string,
): Promise<ChatSession | null> {
  const session = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.id, sessionId));

  return session[0] ?? null;
}

/**
 * 创建新会话
 */
export async function createChatSession(
  mode: string = "general",
): Promise<ChatSession> {
  const [created] = await db
    .insert(chatSessions)
    .values({
      title: "新对话",
      mode,
      messages: [],
    })
    .returning();

  return created;
}

/**
 * 更新会话消息列表
 */
export async function updateChatSessionMessages(
  sessionId: string,
  messages: unknown[],
  title?: string,
  mode?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    messages,
    updatedAt: new Date(),
  };

  if (title?.trim()) {
    updates.title = title.trim();
  }

  if (mode?.trim()) {
    updates.mode = mode.trim();
  }

  await db
    .update(chatSessions)
    .set(updates)
    .where(eq(chatSessions.id, sessionId));
}

/**
 * 删除会话
 */
export async function deleteChatSession(
  sessionId: string,
): Promise<void> {
  await db
    .delete(chatSessions)
    .where(eq(chatSessions.id, sessionId));
}

/**
 * 重命名会话
 */
export async function renameChatSession(
  sessionId: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  await db
    .update(chatSessions)
    .set({ title: trimmed, updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}
