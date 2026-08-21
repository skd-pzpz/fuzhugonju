"use server";

import { and, asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { chapters, novels, scenes } from "@/db/schema";
import { db } from "@/db";
import { extractText, splitScenes, type JsonDoc } from "@/lib/chapter-doc";

const saveChapterSchema = z.object({
  novelId: z.uuid(),
  chapterId: z.uuid(),
  title: z.string().trim().max(200).optional(),
  /** Tiptap JSON 字符串 */
  contentJson: z.string().max(2_000_000),
  wordCount: z.number().int().min(0),
});

export type SaveChapterInput = z.infer<typeof saveChapterSchema>;
export type SaveChapterResult = {
  ok: boolean;
  savedAt: string;
  wordCount: number;
  sceneCount: number;
};

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

/* ------------------------------------------------------------------ */
/*  Server Actions                                                     */
/* ------------------------------------------------------------------ */

/**
 * 保存章节内容：
 * 1. 更新 chapters 表（标题、内容 JSON、字数、更新时间）
 * 2. 按场景分隔线拆分文档，重建 scenes 表
 */
export async function saveChapter(
  input: SaveChapterInput,
): Promise<SaveChapterResult> {
  const userId = await requireUserId();
  const parsed = saveChapterSchema.parse(input);
  const { novelId, chapterId, title, contentJson, wordCount } = parsed;

  await requireNovelOwnership(novelId, userId);

  // 解析并拆分场景
  const doc = JSON.parse(contentJson) as JsonDoc;
  const sceneBlocks = splitScenes(doc);

  await db.transaction(async (tx) => {
    // 1. 更新章节
    await tx
      .update(chapters)
      .set({
        title: title ?? undefined,
        content: contentJson,
        wordCount,
        updatedAt: new Date(),
      })
      .where(and(eq(chapters.id, chapterId), eq(chapters.novelId, novelId)));

    // 2. 重建场景（先清空再插入，保证与文档一致）
    await tx.delete(scenes).where(eq(scenes.chapterId, chapterId));

    if (sceneBlocks.length > 0) {
      await tx.insert(scenes).values(
        sceneBlocks.map((nodes, index) => {
          const text = extractText(nodes).trim();
          return {
            novelId,
            chapterId,
            order: index + 1,
            title: `场景 ${index + 1}`,
            content: JSON.stringify({ type: "doc", content: nodes }),
            summary: text.length > 80 ? `${text.slice(0, 80)}…` : text,
          };
        }),
      );
    }
  });

  revalidatePath(`/novels/${novelId}/editor`);

  return {
    ok: true,
    savedAt: new Date().toISOString(),
    wordCount,
    sceneCount: sceneBlocks.length,
  };
}

/**
 * 获取小说与其全部章节（用于编辑器页面）。
 * - 返回 null：数据库不可用
 * - novel 为 null：小说不存在
 */
export async function getNovelEditorData(novelId: string) {
  const userId = await requireUserId();

  try {
    const novel = await db.query.novels.findFirst({
      where: and(eq(novels.id, novelId), eq(novels.userId, userId)),
    });
    if (!novel) return { novel: null, chapters: [] };

    const chapterList = await db.query.chapters.findMany({
      where: eq(chapters.novelId, novelId),
      orderBy: asc(chapters.order),
    });

    return { novel, chapters: chapterList };
  } catch {
    return null;
  }
}

/**
 * 获取侧边栏章节列表所需数据（小说标题 + 章节）。
 * 返回 null：数据库不可用或小说不存在。
 */
export async function getSidebarChapters(novelId: string) {
  const userId = await requireUserId();

  try {
    const novel = await db.query.novels.findFirst({
      where: and(eq(novels.id, novelId), eq(novels.userId, userId)),
      columns: { id: true, title: true, status: true },
    });
    if (!novel) return null;

    const chapterList = await db.query.chapters.findMany({
      where: eq(chapters.novelId, novelId),
      orderBy: asc(chapters.order),
      columns: { id: true, order: true, title: true },
    });

    return { novel, chapters: chapterList };
  } catch {
    return null;
  }
}

/**
 * 新建章节（追加到末尾），返回新章节（不存在小说时返回 null）。
 */
export async function createChapter(novelId: string) {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  const last = await db.query.chapters.findFirst({
    where: eq(chapters.novelId, novelId),
    orderBy: desc(chapters.order),
    columns: { order: true },
  });

  const nextOrder = (last?.order ?? 0) + 1;
  const [created] = await db
    .insert(chapters)
    .values({ novelId, userId, order: nextOrder })
    .returning({
      id: chapters.id,
      order: chapters.order,
      title: chapters.title,
    });

  if (!created) return null;

  revalidatePath(`/novels/${novelId}/editor`);
  return created;
}

/**
 * 若小说还没有章节，创建第一章。
 */
export async function ensureFirstChapter(novelId: string) {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  const existing = await db.query.chapters.findFirst({
    where: eq(chapters.novelId, novelId),
    orderBy: asc(chapters.order),
  });
  if (existing) return existing;

  const last = await db.query.chapters.findFirst({
    where: eq(chapters.novelId, novelId),
    orderBy: desc(chapters.order),
    columns: { order: true },
  });

  const [created] = await db
    .insert(chapters)
    .values({
      novelId,
      userId,
      title: `第 ${(last?.order ?? 0) + 1} 章`,
      order: (last?.order ?? 0) + 1,
    })
    .returning();

  return created ?? null;
}