"use client";

import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";

import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

/** 轻量 toast 容器，挂在 AppShell 全局位置 */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-72 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-xl border bg-popover p-3 text-sm text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4",
            toast.type === "error"
              ? "border-destructive/30"
              : "border-border",
          )}
        >
          {toast.type === "error" ? (
            <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          ) : toast.type === "warning" ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          )}
          <p className="min-w-0 flex-1 break-words leading-relaxed">
            {toast.message}
          </p>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="ml-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="关闭提示"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
