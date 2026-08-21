"use client";

import { PanelRight } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUIStore } from "@/stores/ui-store";

const pageMeta: Record<string, { title: string; description: string }> = {
  "/workspace/editor": { title: "写作", description: "创作你的故事" },
  "/workspace/characters": { title: "角色", description: "AI 提取与管理的角色档案" },
  "/workspace/timeline": { title: "故事线", description: "剧情发展的可视化视图" },
  "/workspace/settings": { title: "设置", description: "偏好与 AI 配置" },
};

export function WorkspaceHeader() {
  const pathname = usePathname();
  const isAIPanelOpen = useUIStore((state) => state.isAIPanelOpen);
  const setAIPanelOpen = useUIStore((state) => state.setAIPanelOpen);
  const meta =
    pageMeta[pathname] ??
    (pathname.startsWith("/novels/")
      ? { title: "写作", description: "小说编辑器" }
      : { title: "NovelCraft", description: "AI 辅助小说创作平台" });

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <div className="flex items-baseline gap-2">
        <h1 className="text-sm font-semibold">{meta.title}</h1>
        <span className="hidden text-xs text-muted-foreground md:inline">
          {meta.description}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant={isAIPanelOpen ? "default" : "outline"}
          size="sm"
          onClick={() => setAIPanelOpen(!isAIPanelOpen)}
          className="gap-1.5"
        >
          <PanelRight className="size-4" />
          AI 助手
        </Button>
      </div>
    </header>
  );
}
