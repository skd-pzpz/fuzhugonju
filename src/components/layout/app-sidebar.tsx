"use client";

import {
  ChevronDown,
  ChevronRight,
  Download,
  Folder,
  GitBranch,
  Loader2,
  Moon,
  PenLine,
  PencilLine,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import JSZip from "jszip";

import {
  createNovel,
  deleteChapter,
  deleteNovel,
  getAllNovelsWithChapters,
  renameChapter,
  renameNovel,
  reorderChaptersAfterDelete,
  type NovelWithChapters,
} from "@/app/actions/novels";
import { createChapter } from "@/app/actions/chapters";
import {
  exportChapter,
  exportNovelAsText,
  exportAllChaptersAsEntries,
} from "@/app/actions/export";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useToastStore } from "@/stores/toast-store";
import { UserCard } from "@/components/layout/user-card";

const CREATION_GROUP_EXPANDED_KEY = "novelcraft-creation-expanded";
const NOVEL_FOLDERS_KEY = "novelcraft-novel-folders";
const LAST_ACTIVE_NOVEL_KEY = "novelcraft-last-active-novel";

/**
 * 在客户端存储/读取最近使用的小说 ID，
 * 解决切换小说后角色/故事线页面读取不到正确 novelId 的问题。
 */
function getLastActiveNovelId(): string | null {
  try {
    return localStorage.getItem(LAST_ACTIVE_NOVEL_KEY);
  } catch {
    return null;
  }
}
function setLastActiveNovelId(id: string) {
  try {
    localStorage.setItem(LAST_ACTIVE_NOVEL_KEY, id);
  } catch {
    // ignore
  }
}

const navItems = [
  { title: "写作", href: "/workspace/editor", icon: PenLine },
  { title: "角色", href: "/workspace/characters", icon: Users },
  { title: "故事线", href: "/workspace/timeline", icon: GitBranch },
  { title: "设置", href: "/workspace/settings", icon: Settings },
];

/** 检查 novelId 是否在当前小说列表中存在 */
function isValidNovelId(novelId: string | null, novels: NovelWithChapters[]) {
  if (!novelId) return false;
  return novels.some((n) => n.id === novelId);
}

/** 章节显示名 */
function formatChapterLabel(order: number, title: string | null | undefined) {
  const t = (title ?? "").trim();
  if (!t || new RegExp(`^第\\s*${order}\\s*章$`).test(t)) {
    return `第${order}章：未命名`;
  }
  return `第${order}章：${t}`;
}

/** 触发浏览器下载 */
function downloadFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggleMode } = useTheme();
  const [mounted, setMounted] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  // 从路径提取当前 novelId
  const currentNovelId = pathname.match(/^\/novels\/([^/]+)/)?.[1] ?? null;
  // 当前章节（从 search params 提取）
  const [currentChapterId, setCurrentChapterId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCurrentChapterId(params.get("chapter"));
  }, [pathname]);

  // "创作"分组折叠状态
  const [creationGroupOpen, setCreationGroupOpen] = useState(true);

  // 小说列表
  const [novels, setNovels] = useState<NovelWithChapters[]>([]);
  const [novelsLoading, setNovelsLoading] = useState(true);

  // 小说文件夹展开状态（localStorage 持久化）
  const [expandedNovels, setExpandedNovels] = useState<Set<string>>(new Set());

  // 无小说提示 Dialog
  const [noNovelDialogOpen, setNoNovelDialogOpen] = useState(false);

  // 新建小说 Dialog
  const [newNovelDialogOpen, setNewNovelDialogOpen] = useState(false);
  const [newNovelTitle, setNewNovelTitle] = useState("");
  const [newNovelCreating, setNewNovelCreating] = useState(false);

  // 删除章节 AlertDialog
  const [deleteChapterDialog, setDeleteChapterDialog] = useState<{
    chapterId: string;
    novelId: string;
    label: string;
  } | null>(null);
  const [deletingChapter, setDeletingChapter] = useState(false);

  // 删除小说 AlertDialog
  const [deleteNovelDialog, setDeleteNovelDialog] = useState<{
    novelId: string;
    title: string;
  } | null>(null);
  const [deletingNovel, setDeletingNovel] = useState(false);

  // 新建章节 loading
  const [creatingChapterNovelId, setCreatingChapterNovelId] = useState<string | null>(null);

  // 重命名小说
  const [renameNovelDialog, setRenameNovelDialog] = useState<{
    novelId: string;
    title: string;
  } | null>(null);
  const [renameNovelValue, setRenameNovelValue] = useState("");
  const [renamingNovel, setRenamingNovel] = useState(false);

  // 重命名章节
  const [renameChapterDialog, setRenameChapterDialog] = useState<{
    chapterId: string;
    novelId: string;
    currentTitle: string;
  } | null>(null);
  const [renameChapterValue, setRenameChapterValue] = useState("");
  const [renamingChapter, setRenamingChapter] = useState(false);

  // 刷新小说列表
  const refreshNovels = useCallback(async () => {
    try {
      const data = await getAllNovelsWithChapters();
      setNovels(data);
    } catch {
      // 静默失败
    } finally {
      setNovelsLoading(false);
    }
  }, []);

  // 加载小说列表
  useEffect(() => {
    setMounted(true);
    void refreshNovels();
  }, [refreshNovels]);

  // 从 localStorage 恢复展开状态
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NOVEL_FOLDERS_KEY);
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        setExpandedNovels(new Set(ids));
      }
    } catch {
      // ignore
    }
  }, []);

  // 当前小说自动展开并保存为最近使用
  useEffect(() => {
    if (currentNovelId) {
      setExpandedNovels((prev) => {
        if (prev.has(currentNovelId)) return prev;
        const next = new Set(prev);
        next.add(currentNovelId);
        return next;
      });
      setLastActiveNovelId(currentNovelId);
    }
  }, [currentNovelId]);

  // 持久化展开状态
  const persistExpanded = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(NOVEL_FOLDERS_KEY, JSON.stringify([...ids]));
    } catch {
      // ignore
    }
  }, []);

  // 切换小说文件夹展开
  const toggleNovelExpand = (novelId: string) => {
    setExpandedNovels((prev) => {
      const next = new Set(prev);
      if (next.has(novelId)) {
        next.delete(novelId);
      } else {
        next.add(novelId);
      }
      persistExpanded(next);
      return next;
    });
  };

  // 从 localStorage 恢复"创作"分组状态
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CREATION_GROUP_EXPANDED_KEY);
      if (saved !== null) {
        setCreationGroupOpen(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleCreationGroup = () => {
    setCreationGroupOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CREATION_GROUP_EXPANDED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // 新建小说
  const handleCreateNovel = async () => {
    const title = newNovelTitle.trim();
    if (!title) return;
    setNewNovelCreating(true);
    try {
      const result = await createNovel(title);
      if (result) {
        setNewNovelDialogOpen(false);
        setNewNovelTitle("");
        addToast(`小说《${result.title}》创建成功`);
        await refreshNovels();
        // 自动进入编辑器
        router.push(`/novels/${result.id}/editor?chapter=${result.firstChapterId}`);
      } else {
        addToast("创建小说失败", "error");
      }
    } catch {
      addToast("创建小说失败", "error");
    } finally {
      setNewNovelCreating(false);
    }
  };

  // 重命名小说
  const handleRenameNovel = async () => {
    if (!renameNovelDialog) return;
    const { novelId } = renameNovelDialog;
    const newTitle = renameNovelValue.trim();
    if (!newTitle) return;
    setRenamingNovel(true);
    try {
      const result = await renameNovel(novelId, newTitle);
      if (result.ok) {
        addToast(`已重命名为《${newTitle}》`);
        setRenameNovelDialog(null);
        await refreshNovels();
      } else {
        addToast(result.error ?? "重命名失败", "error");
      }
    } catch {
      addToast("重命名失败", "error");
    } finally {
      setRenamingNovel(false);
    }
  };

  // 重命名章节
  const handleRenameChapter = async () => {
    if (!renameChapterDialog) return;
    const { chapterId } = renameChapterDialog;
    const newTitle = renameChapterValue.trim();
    if (!newTitle) return;
    setRenamingChapter(true);
    try {
      const result = await renameChapter(chapterId, newTitle);
      if (result.ok) {
        addToast("章节已重命名");
        setRenameChapterDialog(null);
        await refreshNovels();
      } else {
        addToast(result.error ?? "重命名失败", "error");
      }
    } catch {
      addToast("重命名失败", "error");
    } finally {
      setRenamingChapter(false);
    }
  };

  // 新建章节
  const handleCreateChapter = async (novelId: string) => {
    setCreatingChapterNovelId(novelId);
    try {
      const created = await createChapter(novelId);
      if (created) {
        await refreshNovels();
        router.push(`/novels/${novelId}/editor?chapter=${created.id}`);
      }
    } catch {
      addToast("创建章节失败", "error");
    } finally {
      setCreatingChapterNovelId(null);
    }
  };

  // 删除章节
  const handleDeleteChapter = async () => {
    if (!deleteChapterDialog) return;
    const { chapterId, novelId } = deleteChapterDialog;
    setDeletingChapter(true);
    try {
      const ok = await deleteChapter(chapterId, novelId);
      if (ok) {
        await reorderChaptersAfterDelete(novelId);
        await refreshNovels();
        addToast("已删除");

        // 如果删除的是当前章节，跳到相邻章节或显示空状态
        if (chapterId === currentChapterId) {
          const data = await getAllNovelsWithChapters();
          const novel = data.find((n) => n.id === novelId);
          if (novel && novel.chapters.length > 0) {
            router.push(`/novels/${novelId}/editor?chapter=${novel.chapters[0].id}`);
          } else {
            router.push(`/novels/${novelId}/editor`);
          }
        }
      } else {
        addToast("删除失败", "error");
      }
    } catch {
      addToast("删除失败", "error");
    } finally {
      setDeletingChapter(false);
      setDeleteChapterDialog(null);
    }
  };

  // 删除小说
  const handleDeleteNovel = async () => {
    if (!deleteNovelDialog) return;
    const { novelId, title } = deleteNovelDialog;
    setDeletingNovel(true);
    try {
      const result = await deleteNovel(novelId);
      if (result.ok) {
        setDeleteNovelDialog(null);
        await refreshNovels();
        addToast(`小说《${title}》已删除`);

        // 如果删除的是当前小说，切换到其他小说或编辑器首页
        if (novelId === currentNovelId) {
          const data = await getAllNovelsWithChapters();
          if (data.length > 0) {
            const firstNovel = data[0];
            if (firstNovel.chapters.length > 0) {
              router.push(`/novels/${firstNovel.id}/editor?chapter=${firstNovel.chapters[0].id}`);
            } else {
              router.push(`/novels/${firstNovel.id}/editor`);
            }
          } else {
            router.push("/workspace/editor");
          }
        }
      } else {
        addToast(result.error ?? "删除小说失败", "error");
      }
    } catch {
      addToast("删除小说失败", "error");
    } finally {
      setDeletingNovel(false);
    }
  };

  // 导出单章
  const handleExportChapter = async (chapterId: string) => {
    try {
      const result = await exportChapter(chapterId);
      if (result.success && result.text && result.filename) {
        downloadFile(result.filename, result.text);
        addToast(`已导出 ${result.filename}`);
      } else {
        addToast(result.error ?? "导出失败", "error");
      }
    } catch {
      addToast("导出失败", "error");
    }
  };

  // 导出整本小说（txt）
  const handleExportNovel = async (novelId: string) => {
    try {
      const result = await exportNovelAsText(novelId);
      if (result.success && result.text && result.filename) {
        downloadFile(result.filename, result.text);
        addToast(`已导出 ${result.filename}`);
      } else {
        addToast(result.error ?? "导出失败", "error");
      }
    } catch {
      addToast("导出失败", "error");
    }
  };

  // 导出全部章节（zip）
  const handleExportAllChapters = async (novelId: string) => {
    try {
      const result = await exportAllChaptersAsEntries(novelId);
      if (result.success && result.entries) {
        const zip = new JSZip();
        result.entries.forEach((entry) => {
          zip.file(entry.filename, entry.text);
        });
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const zipName = `${result.novelTitle ?? "小说"}.zip`;
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast(`已导出 ${zipName}`);
      } else {
        addToast(result.error ?? "导出失败", "error");
      }
    } catch {
      addToast("导出失败", "error");
    }
  };

  /** 判断某个 nav item 是否应高亮 */
  const isNavActive = (href: string) => {
    if (href === "/workspace/editor") {
      // 写作：编辑器页面或 /workspace/editor 都算
      return pathname === href || pathname.startsWith("/novels/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/workspace/editor" />}
                className="data-[slot=sidebar-menu-button]:!p-1.5"
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-sidebar-primary-foreground">
                  <Sparkles className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-semibold">NovelCraft</span>
                  <span className="truncate text-xs text-muted-foreground">
                    AI 小说创作
                  </span>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* 创作分组 */}
          <SidebarGroup>
            <SidebarGroupLabel
              onClick={toggleCreationGroup}
              className="cursor-pointer select-none"
            >
              <span className="flex items-center gap-1">
                {creationGroupOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                创作
              </span>
            </SidebarGroupLabel>
            {creationGroupOpen && (
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const hasNovels = novels.length > 0;
                    const effectiveNovelId = currentNovelId ?? getLastActiveNovelId();
                    const validNovelId = hasNovels && isValidNovelId(effectiveNovelId, novels)
                      ? effectiveNovelId
                      : (hasNovels ? novels[0].id : null);

                    // "写作"按钮
                    if (item.href === "/workspace/editor") {
                      const href = validNovelId
                        ? `/novels/${validNovelId}/editor`
                        : item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            render={<Link href={href} suppressHydrationWarning />}
                            tooltip={item.title}
                            isActive={isNavActive(item.href)}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                    // "故事线"和"角色"：需要有效 novelId
                    if (item.href === "/workspace/timeline" || item.href === "/workspace/characters") {
                      // 没有小说时，点击显示弹窗提示
                      if (!hasNovels) {
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              onClick={() => setNoNovelDialogOpen(true)}
                              tooltip={item.title}
                              isActive={isNavActive(item.href)}
                            >
                              <item.icon />
                              <span>{item.title}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      }
                      const href = validNovelId
                        ? `${item.href}?novelId=${validNovelId}`
                        : item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            render={<Link href={href} suppressHydrationWarning />}
                            isActive={isNavActive(item.href)}
                            tooltip={item.title}
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                    // "设置"等其他页面：不需要 novelId
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={isNavActive(item.href)}
                          tooltip={item.title}
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>

          {/* 项目分组 */}
          <SidebarGroup>
            <SidebarGroupLabel>项目</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="新建小说"
                    onClick={() => setNewNovelDialogOpen(true)}
                  >
                    <Plus />
                    <span>新建小说</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* 小说列表（树形结构） */}
          {novels.length > 0 && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {novels.map((novel) => {
                    const isExpanded = expandedNovels.has(novel.id);
                    const isCurrentNovel = novel.id === currentNovelId;

                    return (
                      <SidebarMenuItem key={novel.id}>
                        {/* 小说文件夹行 */}
                        <div className="group/menu-button relative flex w-full items-center">
                          <SidebarMenuButton
                            onClick={() => toggleNovelExpand(novel.id)}
                            isActive={isCurrentNovel && !currentChapterId}
                            tooltip={novel.title}
                            className="pr-16"
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <Folder className="size-4 shrink-0 text-amber-500" />
                            <span className="truncate">{novel.title}</span>
                          </SidebarMenuButton>

                          {/* 小说操作按钮：桌面端 hover 显示，移动端常显（移动端无 hover）*/}
                          <div className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-1 max-md:flex group-hover/menu-button:flex">
                            {/* 重命名小说 */}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setRenameNovelDialog({ novelId: novel.id, title: novel.title });
                                setRenameNovelValue(novel.title);
                              }}
                              title="重命名小说"
                            >
                              <PencilLine className="size-3" />
                            </Button>
                            {/* 导出全部章节 .zip */}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 text-muted-foreground hover:text-foreground"
                              onClick={() => handleExportAllChapters(novel.id)}
                              title="导出全部章节（.zip）"
                            >
                              <Download className="size-3" />
                            </Button>
                            {/* 删除小说 */}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              className="size-5 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                              onClick={() =>
                                setDeleteNovelDialog({
                                  novelId: novel.id,
                                  title: novel.title,
                                })
                              }
                              title="删除小说"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>

                        {/* 章节列表 */}
                        {isExpanded && (
                          <SidebarMenuSub>
                            {novel.chapters.map((chapter) => {
                              const isActive = chapter.id === currentChapterId;
                              const label = formatChapterLabel(
                                chapter.order,
                                chapter.title,
                              );

                              return (
                                <SidebarMenuSubItem key={chapter.id}>
                                  <div className="group/menu-sub-item relative flex w-full items-center">
                                    <SidebarMenuSubButton
                                      render={
                                        <Link
                                          href={`/novels/${novel.id}/editor?chapter=${chapter.id}`}
                                        />
                                      }
                                      isActive={isActive}
                                      className="pr-12"
                                    >
                                      <span className="flex size-3.5 shrink-0 items-center justify-center text-[9px] font-medium tabular-nums text-muted-foreground">
                                        {chapter.order}
                                      </span>
                                      <span className="truncate">{label}</span>
                                    </SidebarMenuSubButton>

                                    {/* 章节操作按钮：桌面端 hover 显示，移动端常显 */}
                                    <div className="absolute right-0.5 top-1/2 z-10 hidden -translate-y-1/2 items-center gap-0.5 max-md:flex group-hover/menu-sub-item:flex">
                                      {/* 重命名章节 */}
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="size-5 text-muted-foreground hover:text-foreground"
                                        onClick={() => {
                                          setRenameChapterDialog({
                                            chapterId: chapter.id,
                                            novelId: novel.id,
                                            currentTitle: chapter.title ?? "",
                                          });
                                          setRenameChapterValue(chapter.title ?? "");
                                        }}
                                        title="重命名章节"
                                      >
                                        <PencilLine className="size-3" />
                                      </Button>
                                      {/* 导出本章 */}
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="size-5 text-muted-foreground hover:text-foreground"
                                        onClick={() =>
                                          handleExportChapter(chapter.id)
                                        }
                                        title="导出本章"
                                      >
                                        <Download className="size-3" />
                                      </Button>
                                      {/* 删除章节 */}
                                      <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        className="size-5 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() =>
                                          setDeleteChapterDialog({
                                            chapterId: chapter.id,
                                            novelId: novel.id,
                                            label,
                                          })
                                        }
                                        title="删除章节"
                                      >
                                        <Trash2 className="size-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </SidebarMenuSubItem>
                              );
                            })}

                            {/* 新建章节按钮 */}
                            <SidebarMenuSubItem>
                              <SidebarMenuSubButton
                                onClick={() => handleCreateChapter(novel.id)}
                                className={`cursor-pointer text-muted-foreground hover:text-foreground ${
                                  creatingChapterNovelId === novel.id ? "opacity-50 pointer-events-none" : ""
                                }`}
                              >
                                {creatingChapterNovelId === novel.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Plus className="size-3.5" />
                                )}
                                <span>
                                  {creatingChapterNovelId === novel.id
                                    ? "创建中…"
                                    : "新建章节"}
                                </span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <UserCard />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="切换主题"
                onClick={toggleMode}
              >
                {mounted ? (
                  mode === "dark" ? (
                    <Sun />
                  ) : (
                    <Moon />
                  )
                ) : (
                  <Sun />
                )}
                {mounted && (
                  <span>{mode === "dark" ? "浅色模式" : "深色模式"}</span>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* 无小说提示 Dialog */}
      <Dialog
        open={noNovelDialogOpen}
        onOpenChange={setNoNovelDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>还没有作品</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            请先创建一部小说，然后再进行角色和故事线的管理。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNoNovelDialogOpen(false)}
            >
              知道了
            </Button>
            <Button
              onClick={() => {
                setNoNovelDialogOpen(false);
                setNewNovelDialogOpen(true);
              }}
            >
              立即创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新建小说 Dialog */}
      <Dialog
        open={newNovelDialogOpen}
        onOpenChange={(open) => {
          setNewNovelDialogOpen(open);
          if (!open) setNewNovelTitle("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建小说</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="请输入小说名称"
            value={newNovelTitle}
            onChange={(e) => setNewNovelTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !newNovelCreating && newNovelTitle.trim()) {
                void handleCreateNovel();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewNovelDialogOpen(false);
                setNewNovelTitle("");
              }}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateNovel}
              disabled={!newNovelTitle.trim() || newNovelCreating}
            >
              {newNovelCreating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  创建中…
                </>
              ) : (
                "创建"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名小说 Dialog */}
      <Dialog
        open={renameNovelDialog !== null}
        onOpenChange={(open) => {
          if (!open) setRenameNovelDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名小说</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="请输入小说名称"
            value={renameNovelValue}
            onChange={(e) => setRenameNovelValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !renamingNovel && renameNovelValue.trim()) {
                void handleRenameNovel();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameNovelDialog(null)}
            >
              取消
            </Button>
            <Button
              onClick={handleRenameNovel}
              disabled={!renameNovelValue.trim() || renamingNovel}
            >
              {renamingNovel ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名章节 Dialog */}
      <Dialog
        open={renameChapterDialog !== null}
        onOpenChange={(open) => {
          if (!open) setRenameChapterDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名章节</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="请输入章节名称"
            value={renameChapterValue}
            onChange={(e) => setRenameChapterValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !renamingChapter && renameChapterValue.trim()) {
                void handleRenameChapter();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameChapterDialog(null)}
            >
              取消
            </Button>
            <Button
              onClick={handleRenameChapter}
              disabled={!renameChapterValue.trim() || renamingChapter}
            >
              {renamingChapter ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除章节 AlertDialog */}
      <AlertDialog
        open={deleteChapterDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteChapterDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除？</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deleteChapterDialog?.label ?? ""}」？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteChapterDialog(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteChapter}
              disabled={deletingChapter}
            >
              {deletingChapter ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  删除中…
                </>
              ) : (
                "删除"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除小说 AlertDialog */}
      <AlertDialog
        open={deleteNovelDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteNovelDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除小说</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除《{deleteNovelDialog?.title ?? ""}》？所有章节、角色、故事线数据将被一并删除，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteNovelDialog(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteNovel}
              disabled={deletingNovel}
            >
              {deletingNovel ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  删除中…
                </>
              ) : (
                "删除"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}