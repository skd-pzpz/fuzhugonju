"use client";

import { Bot, Sparkles, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ChatPanel } from "@/components/ai-chat/chat-panel";
import { CharacterExtraction } from "@/components/ai/character-extraction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function AIPanel() {
  const isOpen = useUIStore((state) => state.isAIPanelOpen);
  const setAIPanelOpen = useUIStore((state) => state.setAIPanelOpen);
  const [tab, setTab] = useState("chat");

  // 分析完成后自动切换到「提取角色」标签页
  const lastAnalysisAt = useAnalysisStore((s) => s.lastAnalysisAt);
  const pendingCount = useAnalysisStore((s) =>
    s.scenes.reduce(
      (sum, scene) =>
        sum + scene.characters.filter((c) => c.status === "pending").length,
      0,
    ),
  );

  useEffect(() => {
    if (lastAnalysisAt) setTab("extract");
  }, [lastAnalysisAt]);

  return (
    <aside
      className={cn(
        "relative flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card transition-all duration-300",
        !isOpen && "w-0 overflow-hidden border-l-0",
      )}
      aria-hidden={!isOpen}
    >
      {/* 面板头部 */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
            <Sparkles className="size-3.5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">AI 助手</p>
            <p className="text-[11px] text-muted-foreground">写作 · 角色 · 灵感</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setAIPanelOpen(false)}
          aria-label="关闭 AI 助手"
        >
          <X />
        </Button>
      </div>

      <Separator />

      {/* 标签页 */}
      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-3 h-8 w-auto justify-start gap-1 rounded-lg bg-muted/50 p-1">
          <TabsTrigger value="chat" className="h-6 gap-1 rounded-md px-3 text-xs">
            <Bot className="size-3.5" />
            对话
          </TabsTrigger>
          <TabsTrigger
            value="extract"
            className="h-6 gap-1 rounded-md px-3 text-xs"
          >
            <UsersRound className="size-3.5" />
            提取角色
            {pendingCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-0.5 h-4 min-w-4 px-1 text-[10px]"
              >
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 对话标签页 */}
        <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col data-[state=active]:flex">
          <ChatPanel onOpenExtract={() => setTab("extract")} />
        </TabsContent>

        {/* 提取角色标签页 */}
        <TabsContent
          value="extract"
          className="min-h-0 flex-1 overflow-hidden data-[state=active]:block"
        >
          <CharacterExtraction />
        </TabsContent>
      </Tabs>
    </aside>
  );
}