"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { chapters, characterAppearances, characters, events, novels, relationships, scenes } from "@/db/schema";
import { db } from "@/db";
import { ensureFirstChapter } from "./chapters";

export type NovelWithChapters = {
  id: string;
  title: string;
  chapters: Array<{
    id: string;
    order: number;
    title: string | null;
  }>;
};

/** 获取当前登录用户 ID，未登录则抛出异常 */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  return session.user.id;
}

/** 检查小说是否属于当前用户（不存在或不属于时抛出异常） */
async function requireNovelOwnership(novelId: string, userId: string): Promise<void> {
  const novel = await db.query.novels.findFirst({
    where: and(eq(novels.id, novelId), eq(novels.userId, userId)),
    columns: { id: true },
  });
  if (!novel) throw new Error("小说不存在或无权限");
}

/**
 * Get all novels with their chapters (ordered by order)
 */
export async function getAllNovelsWithChapters(): Promise<NovelWithChapters[]> {
  const userId = await requireUserId();

  const allNovels = await db.query.novels.findMany({
    where: eq(novels.userId, userId),
    orderBy: asc(novels.createdAt),
    columns: { id: true, title: true },
    with: {
      chapters: {
        orderBy: asc(chapters.order),
        columns: { id: true, order: true, title: true },
      },
    },
  });

  return allNovels.map((n) => ({
    id: n.id,
    title: n.title,
    chapters: n.chapters,
  }));
}

/**
 * Create a new novel with title and ensure first chapter
 */
export async function createNovel(title: string): Promise<{ id: string; title: string; firstChapterId: string } | null> {
  const userId = await requireUserId();

  const [created] = await db
    .insert(novels)
    .values({ title: title.trim(), userId })
    .returning({ id: novels.id, title: novels.title });

  if (!created) return null;

  // Ensure first chapter
  const firstChapter = await ensureFirstChapter(created.id);
  if (!firstChapter) return null;

  revalidatePath("/workspace");
  revalidatePath("/novels");

  return {
    id: created.id,
    title: created.title,
    firstChapterId: firstChapter.id,
  };
}

/**
 * Get a novel by id with chapters
 */
export async function getNovelWithChapters(novelId: string): Promise<NovelWithChapters | null> {
  const userId = await requireUserId();

  const novel = await db.query.novels.findFirst({
    where: and(eq(novels.id, novelId), eq(novels.userId, userId)),
    columns: { id: true, title: true },
    with: {
      chapters: {
        orderBy: asc(chapters.order),
        columns: { id: true, order: true, title: true },
      },
    },
  });

  if (!novel) return null;

  return {
    id: novel.id,
    title: novel.title,
    chapters: novel.chapters,
  };
}

/**
 * Delete a chapter (cascade deletion handled by DB, but we delete dependent rows explicitly for safety)
 */
export async function deleteChapter(chapterId: string, novelId: string): Promise<boolean> {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  try {
    // Cascade handles scenes and character_appearances
    // Events have onDelete set null, so they'll be preserved with null chapterId
    await db
      .delete(chapters)
      .where(and(eq(chapters.id, chapterId), eq(chapters.novelId, novelId)));

    revalidatePath(`/novels/${novelId}/editor`);
    revalidatePath("/workspace");
    return true;
  } catch {
    return false;
  }
}

/**
 * Reorder chapters after deletion (maintain consecutive order)
 * Note: This is optional - unique constraint allows gaps, but consecutive looks better
 */
export async function reorderChaptersAfterDelete(novelId: string): Promise<void> {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  const novelChapters = await db.query.chapters.findMany({
    where: eq(chapters.novelId, novelId),
    orderBy: asc(chapters.order),
    columns: { id: true, order: true },
  });

  // Update order to be 1,2,3... consecutive
  for (let i = 0; i < novelChapters.length; i++) {
    const expectedOrder = i + 1;
    if (novelChapters[i].order !== expectedOrder) {
      await db
        .update(chapters)
        .set({ order: expectedOrder })
        .where(eq(chapters.id, novelChapters[i].id));
    }
  }

  revalidatePath(`/novels/${novelId}/editor`);
}

/**
 * Delete a novel and all associated data.
 * Uses a Drizzle transaction to ensure atomicity.
 */
export async function deleteNovel(novelId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  try {
    await db.transaction(async (tx) => {
      // Delete character_appearances
      await tx
        .delete(characterAppearances)
        .where(eq(characterAppearances.novelId, novelId));

      // Delete events
      await tx
        .delete(events)
        .where(eq(events.novelId, novelId));

      // Delete relationships
      await tx
        .delete(relationships)
        .where(eq(relationships.novelId, novelId));

      // Delete characters
      await tx
        .delete(characters)
        .where(eq(characters.novelId, novelId));

      // Delete scenes
      await tx
        .delete(scenes)
        .where(eq(scenes.novelId, novelId));

      // Delete chapters
      await tx
        .delete(chapters)
        .where(eq(chapters.novelId, novelId));

      // Finally delete the novel itself
      await tx
        .delete(novels)
        .where(and(eq(novels.id, novelId), eq(novels.userId, userId)));
    });

    revalidatePath("/workspace");
    revalidatePath("/novels");
    return { ok: true };
  } catch (error) {
    console.error("删除小说失败:", error);
    return { ok: false, error: "删除失败，请稍后重试" };
  }
}

/**
 * 重命名小说
 */
export async function renameNovel(novelId: string, title: string): Promise<{ ok: boolean; error?: string; title?: string }> {
  const userId = await requireUserId();
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "小说名称不能为空" };
  try {
    await db
      .update(novels)
      .set({ title: trimmed })
      .where(and(eq(novels.id, novelId), eq(novels.userId, userId)));
    revalidatePath("/workspace");
    revalidatePath("/novels");
    return { ok: true, title: trimmed };
  } catch (error) {
    console.error("重命名小说失败:", error);
    return { ok: false, error: "重命名失败，请稍后重试" };
  }
}

/**
 * 重命名章节
 */
export async function renameChapter(chapterId: string, title: string): Promise<{ ok: boolean; error?: string; title?: string }> {
  const userId = await requireUserId();
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "章节名称不能为空" };
  try {
    // 先确认章节所属的小说属于当前用户
    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
      columns: { novelId: true },
    });
    if (!chapter) return { ok: false, error: "章节不存在" };
    await requireNovelOwnership(chapter.novelId, userId);

    await db
      .update(chapters)
      .set({ title: trimmed })
      .where(eq(chapters.id, chapterId));
    revalidatePath("/workspace");
    revalidatePath("/novels");
    return { ok: true, title: trimmed };
  } catch (error) {
    console.error("重命名章节失败:", error);
    return { ok: false, error: "重命名失败，请稍后重试" };
  }
}