"use client";

import dynamic from "next/dynamic";
import { ReactFlowProvider } from "@xyflow/react";

import type { TimelineEvent } from "./storyline-canvas";

/**
 * 故事线画布懒加载包装：
 * - ssr: false：React Flow 画布不参与 SSR，仅客户端渲染（彻底避免 hydration 问题）
 * - ReactFlowProvider 在此提供：page.tsx（server component）不直接 import 任何 @xyflow/react 组件
 * - 加载期间显示骨架屏
 */
const StorylineCanvas = dynamic(
  () =>
    import("./storyline-canvas").then((m) => m.StorylineCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="h-full min-h-[480px] w-full animate-pulse rounded-xl border border-border/70 bg-muted/30" />
    ),
  },
);

export default function StorylineCanvasLazy({
  novelId,
  events,
  focusEventId,
}: {
  novelId: string;
  events: TimelineEvent[];
  focusEventId?: string | null;
}) {
  return (
    <ReactFlowProvider>
      <StorylineCanvas
        novelId={novelId}
        events={events}
        focusEventId={focusEventId}
      />
    </ReactFlowProvider>
  );
}
