"use client";

import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  GitBranch,
  Loader2,
  Redo2,
  Scissors,
  Undo2,
  Wand2,
} from "lucide-react";
import { useState, useCallback } from "react";

import { useTheme, type FontOption } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const FONT_OPTIONS: { id: FontOption; label: string }[] = [
  { id: "system", label: "跟随系统" },
  { id: "kaiti", label: "楷体" },
  { id: "songti", label: "宋体" },
  { id: "heiti", label: "黑体" },
  { id: "fangsong", label: "仿宋" },
  { id: "yahei", label: "微软雅黑" },
  { id: "custom", label: "自定义" },
];

/** 显示字号选项（只改变编辑器显示大小，不影响导出内容） */
const PRESET_FONT_SIZES = [
  { value: "14", label: "14px" },
  { value: "16", label: "16px" },
  { value: "18", label: "18px" },
  { value: "20", label: "20px" },
  { value: "24", label: "24px" },
];

/** 行间距选项 */
const LINE_HEIGHT_OPTIONS = [
  { value: "1.0", label: "1.0" },
  { value: "1.25", label: "1.25" },
  { value: "1.5", label: "1.5" },
  { value: "1.75", label: "1.75" },
  { value: "2.0", label: "2.0" },
  { value: "2.5", label: "2.5" },
  { value: "3.0", label: "3.0" },
];

export function EditorToolbar({
  editor,
  onInsertScene,
  onAnalyze,
  analyzing = false,
  progressText = "",
  onViewTimeline,
  fontSize = "16",
  onFontSizeChange,
  lineHeight = "1.75",
  onLineHeightChange,
}: {
  editor: Editor;
  onInsertScene: () => void;
  onAnalyze?: () => void;
  analyzing?: boolean;
  progressText?: string;
  onViewTimeline?: () => void;
  fontSize?: string;
  onFontSizeChange?: (value: string) => void;
  lineHeight?: string;
  onLineHeightChange?: (value: string) => void;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { level: 0, bold: false, italic: false, canUndo: false, canRedo: false };
      return {
        level: e.isActive("heading") ? (e.getAttributes("heading").level ?? 1) : 0,
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
      };
    },
  });

  const { fontFamily, setFontFamily, fontCustom, setFontCustom } = useTheme();

  // 自定义字号 Dialog
  const [customFontDialogOpen, setCustomFontDialogOpen] = useState(false);
  const [customFontValue, setCustomFontValue] = useState("");

  // 自定义字体 Dialog
  const [customFontFamilyDialogOpen, setCustomFontFamilyDialogOpen] = useState(false);
  const [customFontFamilyValue, setCustomFontFamilyValue] = useState("");

  const handleFontSizeSelect = useCallback(
    (value: string | null) => {
      if (!value || !onFontSizeChange) return;
      if (value === "custom") {
        setCustomFontValue(fontSize === "custom" ? "16" : fontSize);
        setCustomFontDialogOpen(true);
        return;
      }
      onFontSizeChange(value);
    },
    [onFontSizeChange, fontSize],
  );

  const handleCustomFontConfirm = () => {
    const num = parseInt(customFontValue, 10);
    if (!isNaN(num) && num >= 10 && num <= 72) {
      onFontSizeChange?.(String(num));
    }
    setCustomFontDialogOpen(false);
  };

  // 构建字号选项列表，含自定义
  const isCustomFont =
    fontSize !== "custom" &&
    !PRESET_FONT_SIZES.some((o) => o.value === fontSize);
  const displayFontSize = isCustomFont ? fontSize : fontSize;

  // 自定义字号时显示具体数值
  const fontSizeDisplay = isCustomFont
    ? `${fontSize}px`
    : PRESET_FONT_SIZES.find((o) => o.value === fontSize)?.label ?? "16px";

  const fontSizeOptions = [
    ...PRESET_FONT_SIZES,
    { value: "custom", label: "自定义..." },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-background/80 px-3 py-2 backdrop-blur">
      {/* 字体选择 */}
      <Select
        value={fontFamily === "custom" && fontCustom ? "custom" : fontFamily}
        onValueChange={(v) => {
          if (v === "custom") {
            setCustomFontFamilyValue(fontCustom || "");
            setCustomFontFamilyDialogOpen(true);
          } else {
            setFontFamily(v as FontOption);
          }
        }}
      >
        <SelectTrigger
          aria-label="编辑器字体"
          className="h-8 w-[100px] rounded-lg text-[13px]"
        >
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold leading-none">Aa</span>
              {fontFamily === "custom" && fontCustom
                ? fontCustom.length > 8
                  ? fontCustom.slice(0, 8) + "..."
                  : fontCustom
                : FONT_OPTIONS.find((o) => o.id === fontFamily)?.label ?? "跟随系统"}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FONT_OPTIONS.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 显示字号 */}
      {onFontSizeChange && (
        <Select value={displayFontSize} onValueChange={handleFontSizeSelect}>
          <SelectTrigger
            aria-label="显示字号"
            className="h-8 w-[110px] rounded-lg text-[13px]"
          >
            <SelectValue>{fontSizeDisplay}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {fontSizeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 行间距 */}
      {onLineHeightChange && (
        <Select value={lineHeight} onValueChange={(v) => { if (v) onLineHeightChange(v); }}>
          <SelectTrigger
            aria-label="行间距"
            className="h-8 w-[90px] rounded-lg text-[13px]"
          >
            <SelectValue>
              <span className="flex items-center gap-1">
                <span className="text-[11px] font-medium whitespace-nowrap">行间距</span>
                {lineHeight}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {LINE_HEIGHT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* 加粗 / 斜体 */}
      <Tooltip>
        <TooltipTrigger render={<Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="加粗"
          className={cn(state.bold && "bg-muted text-foreground")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="size-4" />
        </Button>} />
        <TooltipContent>加粗</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger render={<Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="斜体"
          className={cn(state.italic && "bg-muted text-foreground")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <span className="font-serif italic leading-none">I</span>
        </Button>} />
        <TooltipContent>斜体</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* 场景分隔线 */}
      <Tooltip>
        <TooltipTrigger render={<Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-[13px]"
          onClick={onInsertScene}
        >
          <Scissors className="size-3.5 text-primary" />
          场景分隔
        </Button>} />
        <TooltipContent>插入场景分隔线，保存时自动拆分</TooltipContent>
      </Tooltip>

      {/* 分析本章（AI 角色提取） */}
      {onAnalyze && (
        <div className="flex flex-col items-center">
          <Tooltip>
            <TooltipTrigger render={<Button
              type="button"
              variant="outline"
              size="sm"
              disabled={analyzing}
              onClick={onAnalyze}
              className="gap-1.5 border-primary/40 bg-primary/10 text-[13px] text-primary hover:bg-primary/20 hover:text-primary"
            >
              {analyzing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Wand2 className="size-3.5" />
              )}
              {analyzing ? "正在分析本章…" : "分析本章"}
            </Button>} />
            <TooltipContent>AI 分析整章提取角色与事件</TooltipContent>
          </Tooltip>
          {analyzing && progressText && (
            <span className="mt-1 whitespace-nowrap text-[10px] text-primary/70">
              {progressText}
            </span>
          )}
        </div>
      )}

      {/* 在故事线中查看（定位到当前章节事件节点） */}
      {onViewTimeline && (
        <Tooltip>
          <TooltipTrigger render={<Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onViewTimeline}
            className="gap-1.5 text-[13px]"
          >
            <GitBranch className="size-3.5 text-primary" />
            在故事线中查看
          </Button>} />
          <TooltipContent>在故事线画布中定位当前章节的事件节点</TooltipContent>
        </Tooltip>
      )}

      <div className="ml-auto flex items-center gap-1">
        {/* 撤销 / 重做 */}
        <Tooltip>
          <TooltipTrigger render={<Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="撤销"
            disabled={!state.canUndo}
            onClick={() => editor?.chain().focus().undo().run()}
          >
            <Undo2 className="size-4" />
          </Button>} />
          <TooltipContent>撤销</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger render={<Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="重做"
            disabled={!state.canRedo}
            onClick={() => editor?.chain().focus().redo().run()}
          >
            <Redo2 className="size-4" />
          </Button>} />
          <TooltipContent>重做</TooltipContent>
        </Tooltip>
      </div>

      {/* 自定义字号 Dialog */}
      <Dialog open={customFontDialogOpen} onOpenChange={setCustomFontDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>自定义字号</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min={10}
              max={72}
              value={customFontValue}
              onChange={(e) => setCustomFontValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCustomFontConfirm();
              }}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              输入字号（10px - 72px）
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCustomFontDialogOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleCustomFontConfirm}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 自定义字体 Dialog */}
      <Dialog open={customFontFamilyDialogOpen} onOpenChange={setCustomFontFamilyDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>自定义字体</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={customFontFamilyValue}
              onChange={(e) => setCustomFontFamilyValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (customFontFamilyValue.trim()) {
                    setFontCustom(customFontFamilyValue.trim());
                  }
                  setCustomFontFamilyDialogOpen(false);
                }
              }}
              placeholder="如 'Noto Serif SC', serif"
              autoFocus
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              输入字体名称或 CSS font-family 值
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCustomFontFamilyDialogOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={() => {
              if (customFontFamilyValue.trim()) {
                setFontCustom(customFontFamilyValue.trim());
              }
              setCustomFontFamilyDialogOpen(false);
            }}>
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}