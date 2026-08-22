"use client";

import { Bot, ChevronRight, PenLine, Plus, Trash2, Wand2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { createChatSession, deleteChatSession, renameChatSession } from "@/app/actions/chat-sessions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChatSessionsStore } from "@/stores/chat-sessions-store";
import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

const modeIconMap: Record<string, typeof Bot> = {
  general: Bot,
  writer_block: Wand2,
  character_advice: PenLine,
};

const modeColorMap: Record<string, string> = {
  general: "text-muted-foreground",
  writer_block: "text-violet-500",
  character_advice: "text-violet-500",
};

export function ChatHistorySidebar() {
  const { sessions, currentSessionId, historyOpen, setCurrentSession, setHistoryOpen, refreshSessions, addSession, removeSession } = useChatSessionsStore();
  const addToast = useToastStore((s) => s.addToast);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const handleSelect = async (id: string) => {
    if (id === currentSessionId) return;
    setCurrentSession(id);
  };

  const handleCreate = async () => {
    try {
      const session = await createChatSession("general");
      addSession({
        id: session.id,
        title: session.title,
        mode: session.mode,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      });
      setCurrentSession(session.id);
      addToast("已创建新对话");
    } catch {
      addToast("创建会话失败", "error");
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteChatSession(id);
      removeSession(id);
      if (id === currentSessionId) {
        setCurrentSession(null);
      }
      addToast("会话已删除");
    } catch {
      addToast("删除失败", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleRename = async () => {
    if (!renamingId || !renameValue.trim()) return;
    try {
      await renameChatSession(renamingId, renameValue);
      await refreshSessions();
      setRenamingId(null);
    } catch {
      addToast("重命名失败", "error");
    }
  };

  return (
    <>
      {/* Toggle button on the rightmost edge */}
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "absolute top-1/2 z-20 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-r-lg border border-l-0 border-border bg-background shadow-sm transition-all",
          historyOpen ? "right-[220px]" : "right-0",
        )}
        onClick={() => setHistoryOpen(!historyOpen)}
        title={historyOpen ? "收起历史会话" : "显示历史会话"}
      >
        <ChevronRight className={cn("size-3 transition-transform", historyOpen && "rotate-180")} />
      </Button>

      {/* History sidebar panel */}
      <div
        className={cn(
          "flex h-full w-[220px] shrink-0 flex-col border-l border-border bg-card transition-all duration-300",
          historyOpen ? "" : "w-0 overflow-hidden border-l-0",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-semibold">历史会话</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="size-5"
            onClick={() => setHistoryOpen(false)}
            title="收起"
          >
            <X className="size-3" />
          </Button>
        </div>

        <div className="shrink-0 px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={() => void handleCreate()}
          >
            <Plus className="size-3.5" />
            新对话
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0.5 px-2 pb-2">
            {sessions.length === 0 && (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                暂无历史会话
              </p>
            )}
            {sessions.map((s) => {
              const Icon = modeIconMap[s.mode] ?? Bot;
              const colorCls = modeColorMap[s.mode] ?? "text-muted-foreground";
              const isActive = s.id === currentSessionId;

              return (
                <div
                  key={s.id}
                  className={cn(
                    "group relative cursor-pointer rounded-md px-2 py-1.5 text-xs transition-colors",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted",
                  )}
                  onClick={() => void handleSelect(s.id)}
                >
                  {renamingId === s.id ? (
                    <input
                      className="w-full rounded bg-background px-1 py-0.5 text-xs outline-none ring-1 ring-ring"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void handleRename();
                        } else if (e.key === "Escape") {
                          setRenamingId(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <div className="flex items-center gap-1 truncate">
                        <Icon className={cn("size-3 shrink-0", colorCls)} />
                        <span className="truncate">{s.title}</span>
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(s.updatedAt).toLocaleDateString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </>
                  )}

                  {renamingId !== s.id && (
                    <div className="absolute -right-0.5 top-1 hidden items-center gap-0.5 rounded-md bg-background shadow-sm max-md:flex group-hover:flex">
                      <button
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingId(s.id);
                          setRenameValue(s.title);
                        }}
                        title="重命名"
                      >
                        <PenLine className="size-3" />
                      </button>
                      <button
                        className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDelete(s.id);
                        }}
                        title="删除"
                      >
                        {deletingId === s.id ? (
                          <span className="size-3 animate-pulse">…</span>
                        ) : (
                          <Trash2 className="size-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
