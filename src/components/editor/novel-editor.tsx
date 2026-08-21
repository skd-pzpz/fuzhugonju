"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { FontFamily } from "@tiptap/extension-font-family";
import { StarterKit } from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { FileText, Loader2, Save, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { analyzeChapter } from "@/app/actions/analysis";
import { saveChapter } from "@/app/actions/chapters";
import { getChapterFocusEvent } from "@/app/actions/events";
import { EditorContextMenu } from "@/components/editor/editor-context-menu";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { SceneBreak } from "@/components/editor/scene-break";
import { Input } from "@/components/ui/input";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useToastStore } from "@/stores/toast-store";
import { useUIStore } from "@/stores/ui-store";

type SaveState = "dirty" | "editing" | "saving" | "saved" | "error";

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

type EditorStats = { wordCount: number; sceneCount: number };

/** 编辑器显示字号（方案 B：只改显示，不影响导出内容），持久化到 localStorage */
const FONT_SIZE_KEY = "novelcraft-editor-font-size";
const DEFAULT_FONT_SIZE = "16";

/** 防抖保存延迟（停止打字后立即保存） */
const DEBOUNCE_SAVE_MS = 300;
/** 兜底保存间隔 */
const BACKUP_SAVE_MS = 30_000;

function computeStatsFromEditor(editor: Editor): EditorStats {
  const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, " ");
  let sceneCount = 0;
  editor.state.doc.descendants((node) => {
    if (node.type.name === "sceneBreak") sceneCount += 1;
    return true;
  });
  return { wordCount: text.replace(/\s+/g, "").length, sceneCount };
}

/** 从 Tiptap JSON 直接统计（编辑器创建前/初始渲染用） */
function computeStatsFromJson(contentJson: string): EditorStats {
  let sceneCount = 0;
  let text = "";
  try {
    const doc = contentJson
      ? (JSON.parse(contentJson) as { content?: unknown[] })
      : null;
    const walk = (nodes: unknown[]) => {
      for (const raw of nodes) {
        const node = raw as { type?: string; text?: string; content?: unknown[] };
        if (node.type === "sceneBreak") sceneCount += 1;
        if (typeof node.text === "string") text += node.text;
        if (Array.isArray(node.content)) walk(node.content);
      }
    };
    if (doc?.content) walk(doc.content);
  } catch {
    // 忽略无效 JSON
  }
  return { wordCount: text.replace(/\s+/g, "").length, sceneCount };
}

export function NovelEditor({
  novelId,
  novelTitle,
  chapterId,
  initialTitle,
  initialContentJson,
  initialUpdatedAt,
}: {
  novelId: string;
  novelTitle: string;
  chapterId: string;
  initialTitle: string;
  initialContentJson: string;
  initialUpdatedAt: Date | null;
}) {
  const [title, setTitle] = useState(initialTitle);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  );

  const initialContent = useMemo(() => {
    if (!initialContentJson) return undefined;
    try {
      return JSON.parse(initialContentJson);
    } catch {
      return undefined;
    }
  }, [initialContentJson]);

  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef(title);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  // 在 effect 中同步标题到 ref
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  /* ---------------- 保存逻辑 ---------------- */

  const flushSave = useCallback(async (force = false) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    if (!force && !dirtyRef.current) return;

    dirtyRef.current = false;
    setSaveState("saving");

    const json = currentEditor.getJSON();
    const rawText = currentEditor.state.doc.textBetween(
      0,
      currentEditor.state.doc.content.size,
      " ",
    );
    const wordCount = rawText.replace(/\s+/g, "").length;

    try {
      await saveChapter({
        novelId,
        chapterId,
        title: titleRef.current.trim() || undefined,
        contentJson: JSON.stringify(json),
        wordCount,
      });
      setSaveState("saved");
      setLastSavedAt(new Date());
    } catch (error) {
      console.error("保存章节失败：", error);
      dirtyRef.current = true;
      setSaveState("error");
    }
  }, [novelId, chapterId]);

  const scheduleSave = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void flushSave();
    }, DEBOUNCE_SAVE_MS);
  }, [flushSave]);

  /** 兜底保存：每 30s 自动保存一次 */
  useEffect(() => {
    backupTimerRef.current = setInterval(() => {
      if (dirtyRef.current) {
        void flushSave();
      }
    }, BACKUP_SAVE_MS);
    return () => {
      if (backupTimerRef.current) clearInterval(backupTimerRef.current);
    };
  }, [flushSave]);

  /* ---------------- 编辑器 ---------------- */

  const editor = useEditor({
    extensions: [StarterKit, SceneBreak, TextStyle, FontFamily],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "novel-editor-content",
        spellcheck: "true",
      },
    },
    onUpdate: () => {
      dirtyRef.current = true;
      setSaveState("dirty");
      scheduleSave();
    },
  });

  /* ---------------- 显示字号（localStorage 持久化） ---------------- */

  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(FONT_SIZE_KEY)
        : null;
    if (saved) setFontSize(saved);
  }, []);

  useEffect(() => {
    if (editor) {
      editor.view.dom.style.fontSize = `${fontSize}px`;
    }
  }, [editor, fontSize]);

  const handleFontSizeChange = useCallback((value: string) => {
    setFontSize(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FONT_SIZE_KEY, value);
    }
  }, []);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    const handler = (content: string) => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.chain().focus().insertContent(content).run();
    };
    useUIStore.getState().setEditorInsertHandler(handler);
    return () => useUIStore.getState().setEditorInsertHandler(null);
  }, []);

  useEffect(() => {
    useUIStore.getState().setActiveContext(novelId, chapterId);
  }, [novelId, chapterId]);

  useEffect(() => {
    if (!editor) return;
    const updateSelection = () => {
      const { from, to } = editor.state.selection;
      const text =
        from !== to ? editor.state.doc.textBetween(from, to, " ") : "";
      useUIStore.getState().setEditorSelection(text.trim());
    };
    editor.on("selectionUpdate", updateSelection);
    return () => {
      editor.off("selectionUpdate", updateSelection);
    };
  }, [editor]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (backupTimerRef.current) clearInterval(backupTimerRef.current);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (dirtyRef.current && editorRef.current) {
        void flushSave();
      }
    };
  }, [flushSave]);

  const insertSceneBreak = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent({ type: "sceneBreak" }).run();
  }, [editor]);

  const [analyzing, setAnalyzing] = useState(false);
  const [progressText, setProgressText] = useState("");
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!editor || analyzing) return;
    setAnalyzing(true);
    useAnalysisStore.getState().startAnalysis(novelId, chapterId);

    // 启动实时进度计时器
    const startTime = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      let text: string;
      if (elapsed < 5) {
        text = "正在读取章节内容…";
      } else if (elapsed < 25) {
        text = `AI 正在提取角色信息…（已用时 ${elapsed} 秒）`;
      } else {
        text = `AI 正在提取事件…（已用时 ${elapsed} 秒）`;
      }
      useAnalysisStore.getState().setProgress(text, elapsed);
      setProgressText(text);
    }, 1000);

    try {
      await flushSave(true);
      const result = await analyzeChapter(novelId, chapterId);
      clearProgressTimer();
      if (result.ok) {
        useAnalysisStore.getState().setResults(result.scenes);
        if (result.modelInfo) {
          useAnalysisStore.getState().setModelInfo(result.modelInfo);
        }
        if (result.fallback) {
          useToastStore.getState().addToast(result.fallback.reason, "warning");
        }
        if (result.modelInfo) {
          const providerLabel =
            result.modelInfo.provider === "zhipu"
              ? "智谱"
              : result.modelInfo.provider === "deepseek"
                ? "DeepSeek"
                : result.modelInfo.provider === "qwen"
                  ? "阿里云"
                  : result.modelInfo.provider === "moonshot"
                    ? "月之暗面"
                    : result.modelInfo.provider === "doubao"
                      ? "豆包"
                      : result.modelInfo.provider === "lingyi"
                        ? "零一万物"
                        : result.modelInfo.provider === "minimax"
                          ? "MiniMax"
                          : result.modelInfo.provider;
          useToastStore.getState().addToast(
            `分析完成，使用 ${providerLabel} · ${result.modelInfo.model}`,
            "success",
          );
        }
      } else {
        useAnalysisStore.getState().failAnalysis(result.error);
      }
    } catch (error) {
      clearProgressTimer();
      console.error("章节分析失败：", error);
      useAnalysisStore.getState().failAnalysis("分析失败，请稍后重试");
    } finally {
      setAnalyzing(false);
      setProgressText("");
    }
  }, [editor, analyzing, novelId, chapterId, flushSave]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    dirtyRef.current = true;
    setSaveState("dirty");
    scheduleSave();
  };

  /* ---------------- 在故事线中查看 ---------------- */

  const router = useRouter();

  const handleViewTimeline = useCallback(async () => {
    try {
      const focusEventId = await getChapterFocusEvent(novelId, chapterId);
      router.push(
        focusEventId
          ? `/workspace/timeline?focus=${focusEventId}`
          : "/workspace/timeline",
      );
    } catch (error) {
      console.error("获取章节事件失败：", error);
      router.push("/workspace/timeline");
    }
  }, [novelId, chapterId, router]);

  /* ---------------- 右键菜单 ---------------- */

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleEditorContextMenu = (e: React.MouseEvent) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;
    const { from, to } = currentEditor.state.selection;
    const text =
      from !== to
        ? currentEditor.state.doc.textBetween(from, to, " ")
        : "";
    const trimmed = text.trim();
    if (!trimmed) return;
    e.preventDefault();
    useUIStore.getState().setEditorSelection(trimmed);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRequestAdvice = () => {
    if (!contextMenu) return;
    const selection = useUIStore.getState().editorSelection;
    if (selection) {
      useUIStore.getState().requestAIPanel("character_advice", selection);
    }
    setContextMenu(null);
  };

  /* ---------------- 实时统计 ---------------- */

  const [stats, setStats] = useState<EditorStats>(() =>
    computeStatsFromJson(initialContentJson),
  );

  useEffect(() => {
    if (!editor) return;
    const update = () => setStats(computeStatsFromEditor(editor));
    update();
    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  // 状态栏文字
  const statusText =
    saveState === "dirty"
      ? "编辑中..."
      : saveState === "saving"
        ? "保存中..."
        : saveState === "error"
          ? "保存失败，点击重试"
          : lastSavedAt
            ? `已保存 ${timeFormatter.format(lastSavedAt)}`
            : "暂无保存";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      {editor && (
        <EditorToolbar
          editor={editor}
          onInsertScene={insertSceneBreak}
          onAnalyze={handleAnalyze}
          analyzing={analyzing}
          progressText={progressText}
          onViewTimeline={handleViewTimeline}
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
        />
      )}

      {/* 编辑区 */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        onContextMenu={handleEditorContextMenu}
      >
        <div className="mx-auto w-full max-w-3xl px-8 py-8">
          <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="size-3.5" />
            {novelTitle}
          </div>

          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="章节标题"
            className="mb-6 h-auto border-none bg-transparent p-0 text-2xl font-bold tracking-tight text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />

          <EditorContent editor={editor} />
        </div>
      </div>

      <EditorContextMenu
        open={contextMenu !== null}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        onClose={() => setContextMenu(null)}
        onRequestAdvice={handleRequestAdvice}
      />

      {/* 底部状态栏 */}
      <div className="flex h-9 shrink-0 items-center gap-4 border-t border-border px-4 text-xs text-muted-foreground">
        <span>
          字数 <span className="font-medium text-foreground">{stats.wordCount}</span>
        </span>
        <span>
          场景 <span className="font-medium text-foreground">{stats.sceneCount}</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {saveState === "saving" && <Loader2 className="size-3 animate-spin" />}
          {saveState === "saved" && <Save className="size-3" />}
          {saveState === "error" ? (
            <button
              type="button"
              onClick={() => void flushSave(true)}
              className="flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors"
            >
              <RefreshCw className="size-3" />
              {statusText}
            </button>
          ) : (
            statusText
          )}
        </span>
      </div>
    </div>
  );
}
