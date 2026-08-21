"use client";

import dynamic from "next/dynamic";

/**
 * AIPanel 懒加载包装：
 * - ssr: false：AI 面板（含 useChat/react-markdown）仅客户端加载
 * - 拆分为独立 chunk，避免其他工作区页面加载聊天相关代码
 */
const AIPanel = dynamic(
  () => import("@/components/layout/ai-panel").then((m) => m.AIPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-[360px] shrink-0 animate-pulse border-l border-border bg-muted/30" />
    ),
  },
);

export default function AIPanelLazy() {
  return <AIPanel />;
}
