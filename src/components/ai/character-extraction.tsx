"use client";

import { Check, Pencil, PencilOff, Sparkles, UserRound, X } from "lucide-react";
import { useState } from "react";

import { confirmCharacter } from "@/app/actions/analysis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useAnalysisStore,
  type ExtractedCharacterItem,
} from "@/stores/analysis-store";

/* ------------------------------------------------------------------ */
/*  角色卡片                                                           */
/* ------------------------------------------------------------------ */

function CharacterCard({
  character,
  onConfirm,
  onEdit,
  onIgnore,
}: {
  character: ExtractedCharacterItem;
  onConfirm: (c: ExtractedCharacterItem) => void;
  onEdit: (c: ExtractedCharacterItem) => void;
  onIgnore: (c: ExtractedCharacterItem) => void;
}) {
  const confirming = character.status === "confirmed";
  const lowConfidence = character.confidence < 0.7;

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card p-3",
        confirming && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white">
            {character.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{character.name}</p>
            {character.occupation && (
              <p className="truncate text-[11px] text-muted-foreground">
                {character.occupation}
              </p>
            )}
          </div>
        </div>
        <Badge
          variant={lowConfidence ? "outline" : "secondary"}
          className={cn(
            "shrink-0 text-[10px]",
            lowConfidence && "border-amber-500/40 text-amber-600 dark:text-amber-400",
          )}
        >
          {Math.round(character.confidence * 100)}% 置信
        </Badge>
      </div>

      {character.traits.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {character.traits.slice(0, 4).map((trait) => (
            <Badge key={trait} variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
              {trait}
            </Badge>
          ))}
        </div>
      )}

      {(character.background || character.appearance) && (
        <p className="line-clamp-3 rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          {character.background || character.appearance}
        </p>
      )}

      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant={confirming ? "secondary" : "default"}
          disabled={confirming}
          onClick={() => onConfirm(character)}
          className="h-7 gap-1 text-xs"
        >
          {confirming ? (
            <>
              <Check className="size-3" /> 已入库
            </>
          ) : (
            <>
              <Check className="size-3" /> 确认入库
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={confirming}
          onClick={() => onEdit(character)}
          className="h-7 gap-1 text-xs"
        >
          <Pencil className="size-3" /> 编辑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={confirming}
          onClick={() => onIgnore(character)}
          className="ml-auto h-7 gap-1 text-xs text-muted-foreground"
        >
          <X className="size-3" /> 忽略
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  编辑弹窗                                                           */
/* ------------------------------------------------------------------ */

function CharacterEditDialog({
  character,
  open,
  onOpenChange,
  onSave,
}: {
  character: ExtractedCharacterItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (c: ExtractedCharacterItem) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    aliases: "",
    occupation: "",
    traits: "",
    appearance: "",
    background: "",
  });

  // 打开时同步表单数据
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (character && syncedKey !== character.key) {
    setSyncedKey(character.key);
    setForm({
      name: character.name,
      aliases: character.aliases.join("、"),
      occupation: character.occupation,
      traits: character.traits.join("、"),
      appearance: character.appearance,
      background: character.background,
    });
  }

  const handleSave = () => {
    if (!character) return;
    const updated: ExtractedCharacterItem = {
      ...character,
      name: form.name.trim(),
      aliases: form.aliases.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
      occupation: form.occupation.trim(),
      traits: form.traits.split(/[、,，]/).map((s) => s.trim()).filter(Boolean),
      appearance: form.appearance.trim(),
      background: form.background.trim(),
    };
    onSave(updated);
    onOpenChange(false);
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" />
            编辑角色
          </DialogTitle>
          <DialogDescription>
            修正 AI 提取的信息，保存后将直接确认入库。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="char-name">姓名</Label>
              <Input id="char-name" value={form.name} onChange={set("name")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="char-aliases">别名（顿号分隔）</Label>
              <Input id="char-aliases" value={form.aliases} onChange={set("aliases")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="char-occupation">职业 / 身份</Label>
            <Input id="char-occupation" value={form.occupation} onChange={set("occupation")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="char-traits">性格标签（顿号分隔）</Label>
            <Input id="char-traits" value={form.traits} onChange={set("traits")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="char-appearance">外貌</Label>
            <Textarea id="char-appearance" value={form.appearance} onChange={set("appearance")} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="char-background">背景 / 经历摘录</Label>
            <Textarea id="char-background" value={form.background} onChange={set("background")} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!form.name.trim()}>
            <Check className="size-3" />
            保存并入库
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  工具函数                                                           */
/* ------------------------------------------------------------------ */

function getProviderLabel(provider: string): string {
  switch (provider) {
    case "zhipu": return "智谱";
    case "deepseek": return "DeepSeek";
    case "qwen": return "阿里云";
    case "moonshot": return "月之暗面";
    case "doubao": return "豆包";
    case "lingyi": return "零一万物";
    case "minimax": return "MiniMax";
    default: return provider;
  }
}

/* ------------------------------------------------------------------ */
/*  主视图                                                             */
/* ------------------------------------------------------------------ */

export function CharacterExtraction() {
  const status = useAnalysisStore((s) => s.status);
  const error = useAnalysisStore((s) => s.error);
  const novelId = useAnalysisStore((s) => s.novelId);
  const scenes = useAnalysisStore((s) => s.scenes);
  const modelInfo = useAnalysisStore((s) => s.modelInfo);
  const markConfirmed = useAnalysisStore((s) => s.markConfirmed);
  const markIgnored = useAnalysisStore((s) => s.markIgnored);
  const updateCharacter = useAnalysisStore((s) => s.updateCharacter);

  const [editing, setEditing] = useState<ExtractedCharacterItem | null>(null);

  const pendingTotal = scenes.reduce(
    (sum, scene) => sum + scene.characters.filter((c) => c.status === "pending").length,
    0,
  );

  const handleConfirm = async (c: ExtractedCharacterItem) => {
    if (!novelId) return;
    try {
      await confirmCharacter(novelId, {
        sceneId: c.sceneId,
        name: c.name,
        aliases: c.aliases,
        occupation: c.occupation,
        traits: c.traits,
        appearance: c.appearance,
        background: c.background,
        confidence: c.confidence,
      });
      markConfirmed(c.key);
    } catch (e) {
      console.error("角色入库失败：", e);
    }
  };

  const handleEditSave = async (updated: ExtractedCharacterItem) => {
    if (!novelId) return;
    updateCharacter(updated.key, {
      name: updated.name,
      aliases: updated.aliases,
      occupation: updated.occupation,
      traits: updated.traits,
      appearance: updated.appearance,
      background: updated.background,
    });
    try {
      await confirmCharacter(novelId, {
        sceneId: updated.sceneId,
        name: updated.name,
        aliases: updated.aliases,
        occupation: updated.occupation,
        traits: updated.traits,
        appearance: updated.appearance,
        background: updated.background,
        confidence: updated.confidence,
      });
      markConfirmed(updated.key);
    } catch (e) {
      console.error("角色入库失败：", e);
    }
  };

  if (status === "idle") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
          <Sparkles className="size-4" />
        </div>
        <p className="text-sm text-muted-foreground">
          点击编辑器顶部的「分析本章」按钮，
          <br />
          AI 将逐场景提取本章出现的角色。
        </p>
      </div>
    );
  }

  if (status === "analyzing") {
    const progressText = useAnalysisStore.getState().progressText;
    const elapsedSeconds = useAnalysisStore.getState().elapsedSeconds;
    // 骨架屏：模拟角色卡片布局，避免界面等待
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-3 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 animate-pulse text-violet-500" />
          {progressText || "正在分析本章…"}
        </div>
        <div className="flex-1 space-y-2.5 overflow-hidden p-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex flex-col gap-2.5 rounded-xl border border-border/70 bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <div className="size-7 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="space-y-1.5">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="flex gap-1">
                <div className="h-4 w-12 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-12 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="h-8 w-full animate-pulse rounded-lg bg-muted/60" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <PencilOff className="size-4" />
        </div>
        <p className="text-sm font-medium">分析失败</p>
        <p className="max-w-xs text-xs text-muted-foreground">{error ?? "未知错误"}</p>
        <p className="text-xs text-muted-foreground/60">
          请检查「设置 → AI 模型配置」中的 API Key 是否正确，或尝试更换模型
        </p>
      </div>
    );
  }

  if (status === "done" && pendingTotal === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Check className="size-4" />
        </div>
        <p className="text-sm text-muted-foreground">所有角色已处理完毕</p>
        {modelInfo && (
          <p className="mt-1 text-xs text-muted-foreground/60">
            分析完成（使用 {getProviderLabel(modelInfo.provider)} · {modelInfo.model}）
          </p>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            共提取 {pendingTotal} 个待确认角色，确认后写入角色档案。
          </p>
          {modelInfo && (
            <p className="shrink-0 text-[10px] text-muted-foreground/50">
              ✅ 使用 {getProviderLabel(modelInfo.provider)} · {modelInfo.model}
            </p>
          )}
        </div>

        {scenes.map((scene) => {
          const visible = scene.characters.filter((c) => c.status !== "ignored");
          if (visible.length === 0) return null;
          return (
            <div key={scene.sceneIndex} className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="inline-block h-3 w-0.5 rounded-full bg-violet-500" />
                场景 {scene.sceneIndex}
                {scene.sceneTitle !== `场景 ${scene.sceneIndex}` && (
                  <span className="truncate text-muted-foreground/70">· {scene.sceneTitle}</span>
                )}
              </p>
              <div className="space-y-2.5">
                {visible.map((character) => (
                  <CharacterCard
                    key={character.key}
                    character={character}
                    onConfirm={handleConfirm}
                    onEdit={(c) => setEditing(c)}
                    onIgnore={(c) => markIgnored(c.key)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <CharacterEditDialog
        character={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={handleEditSave}
      />
    </ScrollArea>
  );
}
