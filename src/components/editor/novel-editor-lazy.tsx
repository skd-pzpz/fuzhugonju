"use client";

import dynamic from "next/dynamic";

/**
 * NovelEditor 懒加载包装：
 * - ssr: false：编辑器（含 Tiptap）不参与 SSR，仅客户端加载
 * - 加载期间显示骨架屏，避免白屏
 * - 将 Tiptap 及其依赖拆分为独立 chunk，减小首屏 JS
 */
const NovelEditor = dynamic(
  () => import("@/components/editor/novel-editor").then((m) => m.NovelEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
          <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-8">
          <div className="mx-auto w-full max-w-3xl">
            <div className="mb-6 h-8 w-1/3 animate-pulse rounded bg-muted" />
            <div className="space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
);

export default function NovelEditorLazy(props: {
  novelId: string;
  novelTitle: string;
  chapterId: string;
  initialTitle: string;
  initialContentJson: string;
  initialUpdatedAt: Date | null;
}) {
  return <NovelEditor {...props} />;
}
