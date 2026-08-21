import { AppSidebar } from "@/components/layout/app-sidebar";
import AIPanelLazy from "@/components/layout/ai-panel-lazy";
import { ChatHistorySidebar } from "@/components/layout/chat-history-sidebar";
import { ClientOnly } from "@/components/client-only-wrapper";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";

/**
 * 应用外壳：左侧导航 + 顶部栏 + 主内容区 + 右侧可折叠 AI 面板 + 历史会话侧栏
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-screen min-h-0 overflow-hidden">
        <div className="relative flex h-full min-h-0 overflow-hidden">
          {/* 主内容区 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <WorkspaceHeader />
            <main className="relative flex min-h-0 flex-1 flex-col overflow-auto p-6">{children}</main>
          </div>
          {/* 右侧面板组：桌面端在流中推挤内容，移动端覆盖 */}
          <div className="flex md:relative md:shrink-0 absolute right-0 top-0 z-10 h-full">
            {/* 右侧可折叠 AI 助手面板（懒加载 + 客户端专属渲染） */}
            <ClientOnly>
              <AIPanelLazy />
            </ClientOnly>
            {/* 历史会话侧栏（最右侧，可折叠） */}
            <ClientOnly>
              <ChatHistorySidebar />
            </ClientOnly>
          </div>
        </div>
      </SidebarInset>
      {/* 全局 toast */}
      <Toaster />
    </SidebarProvider>
  );
}
