"use client";

import { Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, useTransition } from "react";

import { createChapter, getSidebarChapters } from "@/app/actions/chapters";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SidebarChapter = { id: string; order: number; title: string | null };

/** 章节显示名：第N章：标题（标题为空或自动生成时显示"未命名"） */
function formatChapterLabel(order: number, title: string | null | undefined) {
  const t = (title ?? "").trim();
  if (!t || new RegExp(`^第\\s*${order}\\s*章$`).test(t)) {
    return `第${order}章：未命名`;
  }
  return `第${order}章：${t}`;
}

function ChapterListInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentChapterId = searchParams.get("chapter");

  // 从路径中提取 novelId：/novels/[id]/...
  const novelId = pathname.match(/^\/novels\/([^/]+)/)?.[1];

  const [data, setData] = useState<{
    novelTitle: string;
    chapters: SidebarChapter[];
  } | null>(null);
  const [isCreating, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    if (!novelId) {
      setData(null);
      return;
    }
    const res = await getSidebarChapters(novelId);
    setData(
      res
        ? { novelTitle: res.novel.title, chapters: res.chapters }
        : null,
    );
  }, [novelId]);

  // 首次进入或切换章节后刷新（同步编辑器保存的标题）
  useEffect(() => {
    void refresh();
  }, [refresh, currentChapterId]);

  const handleCreateChapter = () => {
    if (!novelId) return;
    startTransition(async () => {
      const created = await createChapter(novelId);
      if (created) {
        await refresh();
        router.push(`/novels/${novelId}/editor?chapter=${created.id}`);
      }
    });
  };

  if (!novelId || !data) return null;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="truncate">
        {data.novelTitle}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {data.chapters.map((chapter) => {
            const active = chapter.id === currentChapterId;
            const label = formatChapterLabel(chapter.order, chapter.title);
            return (
              <SidebarMenuItem key={chapter.id}>
                <SidebarMenuButton
                  render={
                    <Link
                      href={`/novels/${novelId}/editor?chapter=${chapter.id}`}
                    />
                  }
                  isActive={active}
                  tooltip={label}
                  className={active ? "font-medium" : undefined}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center text-[10px] font-medium tabular-nums text-muted-foreground">
                    {chapter.order}
                  </span>
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {/* 新建章节 */}
        <SidebarMenuButton
          onClick={handleCreateChapter}
          disabled={isCreating}
          tooltip="新建章节"
          className="mt-1 text-muted-foreground hover:text-foreground"
        >
          {isCreating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          <span>{isCreating ? "创建中…" : "新建章节"}</span>
        </SidebarMenuButton>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function ChapterList() {
  return (
    <Suspense fallback={null}>
      <ChapterListInner />
    </Suspense>
  );
}
