"use server";

import { and, asc, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { chapters, novels } from "@/db/schema";
import { db } from "@/db";
import { extractText, type JsonDoc } from "@/lib/chapter-doc";

export type ChapterExport = {
  order: number;
  title: string;
  text: string;
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

/**
 * Format chapter label for filename/display
 */
function formatChapterLabel(order: number, title: string | null | undefined) {
  const t = (title ?? "").trim();
  if (!t || new RegExp(`^第\\s*${order}\\s*章$`).test(t)) {
    return `第${order}章：未命名`;
  }
  return `第${order}章：${t}`;
}

/**
 * Extract plain text from a chapter's Tiptap JSON content
 */
function extractChapterText(contentJson: string | null | undefined): string {
  if (!contentJson) return "";
  try {
    const doc = JSON.parse(contentJson) as JsonDoc;
    return extractText(doc.content ?? []).trim();
  } catch {
    return "";
  }
}

/**
 * Get all chapters of a novel with their plain text content
 */
export async function getChaptersForExport(novelId: string): Promise<{
  novelTitle: string;
  chapters: ChapterExport[];
} | null> {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  const novel = await db.query.novels.findFirst({
    where: eq(novels.id, novelId),
    columns: { id: true, title: true },
  });
  if (!novel) return null;

  const chapterList = await db.query.chapters.findMany({
    where: eq(chapters.novelId, novelId),
    orderBy: asc(chapters.order),
    columns: { order: true, title: true, content: true },
  });

  return {
    novelTitle: novel.title,
    chapters: chapterList.map((c) => ({
      order: c.order,
      title: c.title ?? "",
      text: extractChapterText(c.content),
    })),
  };
}

/**
 * Export a single chapter as plain text
 */
export async function exportChapter(chapterId: string): Promise<{
  success: boolean;
  filename?: string;
  text?: string;
  error?: string;
}> {
  try {
    const chapter = await db.query.chapters.findFirst({
      where: eq(chapters.id, chapterId),
      columns: { order: true, title: true, content: true, novelId: true },
      with: {
        novel: {
          columns: { title: true },
        },
      },
    });

    if (!chapter) {
      return { success: false, error: "章节不存在" };
    }

    const userId = await requireUserId();
    await requireNovelOwnership(chapter.novelId, userId);

    const label = formatChapterLabel(chapter.order, chapter.title);
    const text = extractChapterText(chapter.content);
    const filename = `${label}.txt`;

    return { success: true, filename, text };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "导出失败";
    return { success: false, error: msg };
  }
}

/**
 * Export all chapters of a novel as a single text
 */
export async function exportNovelAsText(novelId: string): Promise<{
  success: boolean;
  filename?: string;
  text?: string;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    await requireNovelOwnership(novelId, userId);

    const data = await getChaptersForExport(novelId);
    if (!data) {
      return { success: false, error: "小说不存在" };
    }

    const parts = data.chapters.map((c) => {
      const label = formatChapterLabel(c.order, c.title);
      if (!c.text.trim()) {
        return `# ${label}\n\n（空章节）`;
      }
      return `# ${label}\n\n${c.text}`;
    });

    const fullText = parts.join("\n\n---\n\n");
    const filename = `${data.novelTitle}.txt`;

    return { success: true, filename, text: fullText };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "导出失败";
    return { success: false, error: msg };
  }
}

/**
 * Export all chapters of a novel as individual text entries (for zip packaging on client)
 */
export async function exportAllChaptersAsEntries(novelId: string): Promise<{
  success: boolean;
  novelTitle?: string;
  entries?: Array<{ filename: string; text: string }>;
  error?: string;
}> {
  try {
    const userId = await requireUserId();
    await requireNovelOwnership(novelId, userId);

    const data = await getChaptersForExport(novelId);
    if (!data) {
      return { success: false, error: "小说不存在" };
    }

    const entries = data.chapters.map((c) => {
      const label = formatChapterLabel(c.order, c.title);
      return {
        filename: `${label}.txt`,
        text: c.text.trim() || "（空章节）",
      };
    });

    return { success: true, novelTitle: data.novelTitle, entries };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "导出失败";
    return { success: false, error: msg };
  }
}