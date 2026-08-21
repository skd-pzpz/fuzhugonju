"use client";

import { PenLine } from "lucide-react";
import { useEffect, useRef } from "react";

/** 编辑器右键菜单：对选中文本提供「查看行为建议」 */
export function EditorContextMenu({
  open,
  x,
  y,
  onClose,
  onRequestAdvice,
}: {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onRequestAdvice: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // 点击菜单外 / Esc 关闭
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  // 防止菜单超出可视区域
  const style = {
    top: Math.min(y, window.innerHeight - 120),
    left: Math.min(x, window.innerWidth - 200),
  };

  return (
    <div
      ref={ref}
      role="menu"
      style={style}
      className="fixed z-[90] w-44 overflow-hidden rounded-lg border border-border bg-popover py-1 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95"
    >
      <button
        type="button"
        role="menuitem"
        onClick={onRequestAdvice}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
      >
        <PenLine className="size-3.5 text-primary" />
        查看行为建议
      </button>
    </div>
  );
}
