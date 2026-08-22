"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { FontFamily } from "@tiptap/extension-font-family";
import { StarterKit } from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { FileText, GripVertical, ImageUp, Loader2, Maximize2, Minimize2, Palette, RefreshCw, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { analyzeChapter } from "@/app/actions/analysis";
import { saveChapter } from "@/app/actions/chapters";
import { getChapterFocusEvent } from "@/app/actions/events";
import { EditorContextMenu } from "@/components/editor/editor-context-menu";
import { EditorToolbar } from "@/components/editor/editor-toolbar";
import { SceneBreak } from "@/components/editor/scene-break";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

/** 编辑器背景图片 & 透明度，持久化到 localStorage */
const BG_IMAGE_KEY = "novelcraft-editor-bg-image";
const BG_OPACITY_KEY = "novelcraft-editor-bg-opacity";
const DEFAULT_BG_OPACITY = "15";
const BG_BLUR_KEY = "novelcraft-editor-bg-blur";
const DEFAULT_BG_BLUR = "16";
const BG_NOISE_KEY = "novelcraft-editor-bg-noise";

/** 背景图片显示方式 & 位置，持久化到 localStorage */
const BG_SIZE_KEY = "novelcraft-editor-bg-size";
const BG_POSITION_KEY = "novelcraft-editor-bg-position";
const BG_BLUR_ENABLED_KEY = "novelcraft-editor-bg-blur-enabled";

/** 卡片样式，持久化到 localStorage */
const CARD_STYLE_KEY = "novelcraft-editor-card-style";
type CardStyle = "glass" | "paper" | "notebook";
const DEFAULT_CARD_STYLE: CardStyle = "glass";

/** 沉浸写作模式，持久化到 localStorage */
const IMMERSIVE_KEY = "novelcraft-editor-immersive";

/** 编辑器卡片宽度（可拖拽缩放），持久化到 localStorage */
const CARD_WIDTH_KEY = "novelcraft-editor-card-width";
const DEFAULT_CARD_WIDTH = 760;
const MIN_CARD_WIDTH = 480;
const MAX_CARD_WIDTH = 1200;

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

/** 卡片样式 - 根据所选风格返回 CSS 样式对象 */
function getCardStyle(
  style: CardStyle,
  dark: boolean,
  opacity: number,
  blurEnabled: boolean,
  blurPx: string,
): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: "12px",
    marginTop: "3rem",
    marginBottom: "3rem",
  };

  if (style === "glass") {
    return {
      ...base,
      background: dark
        ? `rgba(30, 30, 35, ${opacity})`
        : `rgba(255, 255, 255, ${opacity})`,
      ...(blurEnabled
        ? {
            backdropFilter: `blur(${blurPx}px) saturate(1.2)`,
            WebkitBackdropFilter: `blur(${blurPx}px) saturate(1.2)`,
            willChange: "backdrop-filter",
          }
        : {}),
      border: dark
        ? "1px solid rgba(255,255,255,0.08)"
        : "1px solid rgba(255,255,255,0.35)",
      boxShadow: dark
        ? `
          0 8px 32px rgba(0,0,0,0.4),
          inset 0 1px 0 rgba(255,255,255,0.06)
        `
        : `
          0 8px 32px rgba(0,0,0,0.12),
          inset 0 1px 0 rgba(255,255,255,0.4),
          inset 0 -1px 0 rgba(0,0,0,0.05)
        `,
    };
  }

  if (style === "paper") {
    return {
      ...base,
      background: dark
        ? `rgba(40, 38, 33, ${opacity})`
        : `rgba(245, 240, 232, ${opacity})`,
      border: dark
        ? "1px solid rgba(255,255,255,0.06)"
        : "1px solid rgba(180, 170, 150, 0.3)",
      boxShadow: dark
        ? "0 4px 24px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.15)"
        : "0 4px 24px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
      // 柔和纸纹
      backgroundImage: dark
        ? "radial-gradient(ellipse at 20% 50%, rgba(255,255,255,0.02) 0%, transparent 50%)"
        : "radial-gradient(ellipse at 20% 50%, rgba(255,248,240,0.4) 0%, transparent 50%)",
    };
  }

  // notebook
  return {
    ...base,
    background: dark
      ? `rgba(30, 32, 38, ${opacity})`
      : `rgba(255, 255, 255, ${opacity})`,
    border: dark
      ? "1px solid rgba(255,255,255,0.06)"
      : "1px solid rgba(200, 200, 210, 0.3)",
    boxShadow: dark
      ? "0 4px 20px rgba(0,0,0,0.25)"
      : "0 4px 20px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)",
    // 笔记本横线
    backgroundImage: dark
      ? "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(255,255,255,0.04) 31px, rgba(255,255,255,0.04) 32px)"
      : "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(200, 200, 215, 0.25) 31px, rgba(200, 200, 215, 0.25) 32px)",
    // 左侧红色边线
    outline: "none",
    // 用伪元素无法在 inline style 实现，用 border-left 模拟
    borderLeft: dark
      ? "2px solid rgba(220, 80, 80, 0.2)"
      : "2px solid rgba(220, 80, 80, 0.15)",
  };
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

  /* ---------------- 编辑器背景图片 & 效果 ---------------- */

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bgDialogOpen, setBgDialogOpen] = useState(false);
  const [bgImage, setBgImage] = useState("");
  const [bgOpacity, setBgOpacity] = useState(DEFAULT_BG_OPACITY);
  const [bgBlur, setBgBlur] = useState(DEFAULT_BG_BLUR);
  const [bgBlurEnabled, setBgBlurEnabled] = useState(true);
  const [bgNoise, setBgNoise] = useState(true);
  const [bgSize, setBgSize] = useState("cover");
  const [bgPosition, setBgPosition] = useState("center");
  const [cardStyle, setCardStyle] = useState<CardStyle>(DEFAULT_CARD_STYLE);
  const [immersiveMode, setImmersiveMode] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedImage = window.localStorage.getItem(BG_IMAGE_KEY);
    if (savedImage) setBgImage(savedImage);
    const savedOpacity = window.localStorage.getItem(BG_OPACITY_KEY);
    if (savedOpacity) setBgOpacity(savedOpacity);
    const savedBlur = window.localStorage.getItem(BG_BLUR_KEY);
    if (savedBlur) setBgBlur(savedBlur);
    const savedBlurEnabled = window.localStorage.getItem(BG_BLUR_ENABLED_KEY);
    if (savedBlurEnabled !== null) setBgBlurEnabled(savedBlurEnabled === "true");
    const savedNoise = window.localStorage.getItem(BG_NOISE_KEY);
    if (savedNoise !== null) setBgNoise(savedNoise === "true");
    const savedSize = window.localStorage.getItem(BG_SIZE_KEY);
    if (savedSize) setBgSize(savedSize);
    const savedPos = window.localStorage.getItem(BG_POSITION_KEY);
    if (savedPos) setBgPosition(savedPos);
    const savedStyle = window.localStorage.getItem(CARD_STYLE_KEY);
    if (savedStyle === "glass" || savedStyle === "paper" || savedStyle === "notebook") setCardStyle(savedStyle);
    const savedImmersive = window.localStorage.getItem(IMMERSIVE_KEY);
    if (savedImmersive !== null) setImmersiveMode(savedImmersive === "true");
  }, []);

  const handleBgImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setBgImage(dataUrl);
      window.localStorage.setItem(BG_IMAGE_KEY, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleBgImageRemove = useCallback(() => {
    setBgImage("");
    setBgOpacity(DEFAULT_BG_OPACITY);
    setBgBlur(DEFAULT_BG_BLUR);
    setBgBlurEnabled(true);
    setBgNoise(true);
    setBgSize("cover");
    setBgPosition("center");
    setCardStyle(DEFAULT_CARD_STYLE);
    localStorage.removeItem(BG_IMAGE_KEY);
    localStorage.removeItem(BG_OPACITY_KEY);
    localStorage.removeItem(BG_BLUR_KEY);
    localStorage.removeItem(BG_BLUR_ENABLED_KEY);
    localStorage.removeItem(BG_NOISE_KEY);
    localStorage.removeItem(BG_SIZE_KEY);
    localStorage.removeItem(BG_POSITION_KEY);
    localStorage.removeItem(CARD_STYLE_KEY);
  }, []);

  const setAndPersist = useCallback(
    <T,>(key: string, setter: (v: T) => void, value: T) => {
      setter(value);
      window.localStorage.setItem(key, String(value));
    },
    [],
  );

  const toggleImmersive = useCallback(() => {
    setImmersiveMode((prev) => {
      const next = !prev;
      window.localStorage.setItem(IMMERSIVE_KEY, String(next));
      return next;
    });
  }, []);

  /* ---------------- 编辑器卡片宽度（拖拽缩放） ---------------- */

  const [cardWidth, setCardWidth] = useState(DEFAULT_CARD_WIDTH);
  const dragRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(CARD_WIDTH_KEY);
    if (saved) {
      const w = parseInt(saved, 10);
      if (!isNaN(w) && w >= MIN_CARD_WIDTH && w <= MAX_CARD_WIDTH) {
        setCardWidth(w);
      }
    }
  }, []);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const currentWidth = cardWidth;
      dragRef.current = { startX: clientX, startWidth: currentWidth };

      const onMove = (ev: MouseEvent | TouchEvent) => {
        if (!dragRef.current) return;
        const currentX = "touches" in ev ? ev.touches[0].clientX : ev.clientX;
        const diff = currentX - dragRef.current.startX;
        // 拖拽方向：向右拉变宽，向左拉变窄
        const newWidth = Math.max(
          MIN_CARD_WIDTH,
          Math.min(MAX_CARD_WIDTH, dragRef.current.startWidth + diff),
        );
        setCardWidth(newWidth);
      };

      const onUp = () => {
        if (!dragRef.current) return;
        const finalWidth = Math.max(
          MIN_CARD_WIDTH,
          Math.min(MAX_CARD_WIDTH, dragRef.current.startWidth),
        );
        window.localStorage.setItem(CARD_WIDTH_KEY, String(finalWidth));
        dragRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp);
    },
    [cardWidth],
  );

  /* ---------------- 暗色模式检测 ---------------- */

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
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
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "分析失败，请稍后重试";
      useAnalysisStore.getState().failAnalysis(msg);
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
    <div
      className={`flex h-full flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm ${
        immersiveMode ? "fixed inset-0 z-50 rounded-none border-none shadow-none" : ""
      }`}
    >
      {editor && !immersiveMode && (
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
        className={`min-h-0 flex-1 overflow-y-auto ${immersiveMode ? "h-dvh" : ""}`}
        onContextMenu={handleEditorContextMenu}
        style={
          bgImage
            ? {
                backgroundImage: `url(${bgImage})`,
                backgroundSize: bgSize,
                backgroundPosition: bgPosition,
                backgroundRepeat: "no-repeat",
                backgroundAttachment: "fixed",
              }
            : undefined
        }
      >
        {/* 噪点纹理 - 增加纸张/画布质感 */}
        {bgImage && bgNoise && (
          <div
            className="pointer-events-none fixed inset-0"
            style={{
              opacity: 0.03,
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
              zIndex: 1,
            }}
          />
        )}

        <div
          className="mx-auto w-full px-6 py-8"
          style={
            bgImage
              ? {
                  maxWidth: `${cardWidth}px`,
                  ...getCardStyle(cardStyle, isDark, Number(bgOpacity) / 100, bgBlurEnabled, bgBlur),
                  position: "relative",
                  zIndex: 2,
                }
              : {
                  maxWidth: `${cardWidth}px`,
                }
          }
        >
          {/* 拖拽缩放手柄 */}
          <div
            className="absolute -right-3 top-0 bottom-0 z-10 flex cursor-col-resize items-center justify-center opacity-0 hover:opacity-100 transition-opacity touch-none select-none"
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          >
            <div className="flex h-16 w-1.5 items-center justify-center rounded-full bg-border/60 hover:bg-primary/50 transition-colors">
              <GripVertical className="size-3 text-muted-foreground" />
            </div>
          </div>
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

      {/* 底部状态栏 - 沉浸模式隐藏 */}
      {!immersiveMode && (
        <div className="flex h-9 shrink-0 items-center gap-4 border-t border-border px-4 text-xs text-muted-foreground">
          <span>
            字数 <span className="font-medium text-foreground">{stats.wordCount}</span>
          </span>
          <span>
            场景 <span className="font-medium text-foreground">{stats.sceneCount}</span>
          </span>

          {/* 卡片宽度 */}
          <span className="hidden sm:inline-flex items-center gap-1">
            <GripVertical className="size-3" />
            {cardWidth}px
          </span>

          {/* 编辑背景 - 统一按钮 */}
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleBgImageUpload}
            />
            <button
              type="button"
              onClick={() => setBgDialogOpen(true)}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                bgImage
                  ? "bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="编辑背景设置"
            >
              <Palette className="size-3" />
              背景
            </button>
          </div>

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

          {/* 沉浸模式切换 */}
          <button
            type="button"
            onClick={toggleImmersive}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="沉浸写作模式"
          >
            <Maximize2 className="size-3" />
          </button>
        </div>
      )}

      {/* 沉浸模式退出按钮 */}
      {immersiveMode && (
        <button
          type="button"
          onClick={toggleImmersive}
          className="fixed top-3 right-3 z-50 flex items-center gap-1.5 rounded-lg bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm border border-border hover:bg-background hover:text-foreground transition-all opacity-30 hover:opacity-100"
          title="退出沉浸模式"
        >
          <Minimize2 className="size-3.5" />
          退出
        </button>
      )}

      {/* 背景设置对话框 */}
      <Dialog open={bgDialogOpen} onOpenChange={setBgDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Palette className="size-4" />
              编辑背景设置
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* 上传图片 */}
            <div className="space-y-2">
              <Label>背景图片</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <ImageUp className="size-4" />
                  {bgImage ? "更换图片" : "上传图片"}
                </Button>
                {bgImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBgImageRemove}
                    className="gap-1.5 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                    移除
                  </Button>
                )}
              </div>
              {bgImage && (
                <p className="text-xs text-muted-foreground">
                  图片已加载，可调整下方参数
                </p>
              )}
            </div>

            {bgImage && (
              <>
                {/* 分隔线 */}
                <div className="border-t border-border" />

                {/* 透明度 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>卡片透明度</Label>
                    <span className="text-xs text-muted-foreground">{bgOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    value={bgOpacity}
                    onChange={(e) =>
                      setAndPersist(BG_OPACITY_KEY, setBgOpacity, e.target.value)
                    }
                    className="h-1.5 w-full cursor-pointer accent-primary"
                  />
                </div>

                {/* 毛玻璃模糊 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>毛玻璃模糊</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{bgBlur}px</span>
                      <Switch
                        checked={bgBlurEnabled}
                        onCheckedChange={(v) =>
                          setAndPersist(BG_BLUR_ENABLED_KEY, setBgBlurEnabled, v)
                        }
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="30"
                    value={bgBlur}
                    disabled={!bgBlurEnabled}
                    onChange={(e) =>
                      setAndPersist(BG_BLUR_KEY, setBgBlur, e.target.value)
                    }
                    className="h-1.5 w-full cursor-pointer accent-primary disabled:opacity-40"
                  />
                </div>

                {/* 图片显示方式 */}
                <div className="space-y-2">
                  <Label>图片显示方式</Label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["cover", "contain", "fill", "auto"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAndPersist(BG_SIZE_KEY, setBgSize, s)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                          bgSize === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {s === "cover" ? "铺满" : s === "contain" ? "适应" : s === "fill" ? "拉伸" : "原大小"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 图片位置 */}
                <div className="space-y-2">
                  <Label>图片位置</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAndPersist(BG_POSITION_KEY, setBgPosition, p)}
                        className={`rounded-md px-1 py-1 text-[11px] font-medium transition-colors ${
                          bgPosition === p
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {p === "center" ? "居中" : p === "top" ? "顶部" : p === "bottom" ? "底部" : p === "left" ? "左侧" : p === "right" ? "右侧" : p === "top-left" ? "左上" : p === "top-right" ? "右上" : p === "bottom-left" ? "左下" : "右下"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 噪点纹理 */}
                <div className="flex items-center justify-between">
                  <Label>画布噪点纹理</Label>
                  <Switch
                    checked={bgNoise}
                    onCheckedChange={(v) =>
                      setAndPersist(BG_NOISE_KEY, setBgNoise, v)
                    }
                  />
                </div>

                {/* 分隔线 */}
                <div className="border-t border-border" />

                {/* 卡片样式 */}
                <div className="space-y-2">
                  <Label>卡片样式</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["glass", "paper", "notebook"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAndPersist(CARD_STYLE_KEY, setCardStyle, s)}
                        className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                          cardStyle === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {s === "glass" ? "毛玻璃" : s === "paper" ? "纸张" : "笔记本"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
