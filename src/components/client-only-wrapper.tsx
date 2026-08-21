"use client";

import { useEffect, useState } from "react";

/**
 * 客户端专属渲染兜底：
 * - SSR 阶段渲染占位 div（不产生可 hydration 的真实内容），
 * - 仅在客户端挂载后渲染 children，
 * 从根源上消除子树的 hydration 不匹配（用于 React Flow 画布、AI 面板、编辑器等重型组件）。
 */
export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ minHeight: "500px" }} />;
  return <>{children}</>;
}
