import { DatabaseZap, FileQuestion } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

import {
  ensureFirstChapter,
  getNovelEditorData,
} from "@/app/actions/chapters";
import { ClientOnly } from "@/components/client-only-wrapper";
import NovelEditorLazy from "@/components/editor/novel-editor-lazy";

export default async function NovelEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { id } = await params;
  const { chapter: chapterParam } = await searchParams;

  const data = await getNovelEditorData(id);

  // 数据库不可用时的友好提示
  if (data === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <DatabaseZap className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">无法连接数据库</p>
          <p className="mt-1 text-xs text-muted-foreground">
            请确认 PostgreSQL 已启动，并检查 .env 中的 DATABASE_URL 配置。
          </p>
        </div>
      </div>
    );
  }

  if (!data.novel) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <FileQuestion className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">小说不存在</p>
          <p className="mt-1 text-xs text-muted-foreground">
            该小说可能已被删除，或您没有访问权限。
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/workspace/editor"
            className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  // 尚无章节时自动创建第一章
  let chapters = data.chapters;
  if (chapters.length === 0) {
    const created = await ensureFirstChapter(id);
    if (created) chapters = [created];
  }
  if (chapters.length === 0) {
    redirect(`/workspace/editor`);
  }

  // 通过 ?chapter= 切换章节；无参数或参数无效时重定向到第一章（规范 URL）
  const firstChapter = chapters[0];
  if (!chapterParam || !chapters.some((c) => c.id === chapterParam)) {
    redirect(`/novels/${id}/editor?chapter=${firstChapter.id}`);
  }
  const current = chapters.find((c) => c.id === chapterParam)!;

  return (
    // ClientOnly + 懒加载（ssr:false）：Tiptap 编辑器完全客户端渲染
    <ClientOnly>
      <NovelEditorLazy
        key={current.id}
        novelId={data.novel.id}
        novelTitle={data.novel.title}
        chapterId={current.id}
        initialTitle={current.title ?? ""}
        initialContentJson={current.content ?? ""}
        initialUpdatedAt={current.updatedAt}
      />
    </ClientOnly>
  );
}
