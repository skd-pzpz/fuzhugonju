"use server";

import { and, asc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { events, novels } from "@/db/schema";
import { db } from "@/db";

/** 获取当前登录用户 ID，未登录则抛出异常 */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  return session.user.id;
}

/** 检查小说是否属于当前用户 */
async function requireNovelOwnership(novelId: string, userId: string): Promise<void> {
  const novel = await db.query.novels.findFirst({
    where: and(eq(novels.id, novelId), eq(novels.userId, userId)),
    columns: { id: true },
  });
  if (!novel) throw new Error("小说不存在或无权限");
}

/** 事件 data 字段中保存的可视化数据 */
type EventFlowData = {
  x?: number;
  y?: number;
  /** main 主线 | branch 支线 */
  storyline?: string;
  /** 手动连接的目标事件 id 列表 */
  outgoing?: string[];
  /** AI 提取时涉及的角色名（可能包含未入库档案的角色） */
  relatedNames?: string[];
  source?: string;
};

/** 读取事件的 data 字段（jsonb 合并用） */
async function getEventData(eventId: string): Promise<EventFlowData> {
  const row = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { data: true },
  });
  return (row?.data ?? {}) as EventFlowData;
}

/** 更新事件节点在画布中的位置 */
export async function updateEventPosition(
  eventId: string,
  x: number,
  y: number,
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: { novelId: true },
  });
  if (!event) return { ok: false };
  await requireNovelOwnership(event.novelId, userId);

  const data = await getEventData(eventId);
  await db
    .update(events)
    .set({ data: { ...data, x, y } })
    .where(eq(events.id, eventId));
  return { ok: true };
}

/** 用户手动连接：source 事件 -> target 事件（因果边） */
export async function addEventEdge(
  sourceId: string,
  targetId: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();

  const source = await db.query.events.findFirst({
    where: eq(events.id, sourceId),
    columns: { novelId: true },
  });
  if (!source) return { ok: false, error: "源事件不存在" };
  await requireNovelOwnership(source.novelId, userId);

  if (sourceId === targetId) return { ok: false, error: "不能连接到自身" };
  const data = await getEventData(sourceId);
  const outgoing = new Set<string>(data.outgoing ?? []);
  outgoing.add(targetId);
  await db
    .update(events)
    .set({ data: { ...data, outgoing: [...outgoing] } })
    .where(eq(events.id, sourceId));
  return { ok: true };
}

/** 删除手动连接的边 */
export async function removeEventEdge(
  sourceId: string,
  targetId: string,
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();

  const source = await db.query.events.findFirst({
    where: eq(events.id, sourceId),
    columns: { novelId: true },
  });
  if (!source) return { ok: false };
  await requireNovelOwnership(source.novelId, userId);

  const data = await getEventData(sourceId);
  const outgoing = (data.outgoing ?? []).filter((id) => id !== targetId);
  await db
    .update(events)
    .set({ data: { ...data, outgoing } })
    .where(eq(events.id, sourceId));
  return { ok: true };
}

/** 重置该小说全部事件的位置（清空 x/y，重新自动排列） */
export async function resetEventPositions(
  novelId: string,
): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  const list = await db.query.events.findMany({
    where: eq(events.novelId, novelId),
    columns: { id: true, data: true },
  });
  for (const row of list) {
    const { x: _x, y: _y, ...rest } = (row.data ?? {}) as EventFlowData;
    await db
      .update(events)
      .set({ data: rest })
      .where(eq(events.id, row.id));
  }
  return { ok: true };
}

/**
 * 编辑器「在故事线中查看」：返回当前章节的第一个事件 id（用于定位高亮），
 * 该章节无事件时返回 null。
 */
export async function getChapterFocusEvent(
  novelId: string,
  chapterId: string,
): Promise<string | null> {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  const row = await db.query.events.findFirst({
    where: and(
      eq(events.novelId, novelId),
      eq(events.chapterId, chapterId),
    ),
    orderBy: asc(events.position),
    columns: { id: true },
  });
  return row?.id ?? null;
}