"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { memo, useState } from "react";

import { deleteCharacter } from "@/app/actions/characters";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAnalysisStore } from "@/stores/analysis-store";
import { useToastStore } from "@/stores/toast-store";

export type CharacterCardData = {
  id: string;
  name: string;
  role: string | null;
  traits: string[] | null;
  description: string | null;
};

function initials(name: string) {
  return name.trim().slice(0, 1) || "?";
}

export const CharacterCard = memo(function CharacterCard({
  character,
}: {
  character: CharacterCardData;
}) {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const result = await deleteCharacter(character.id);
      if (result.ok) {
        addToast(`已删除角色「${character.name}」`);
        // 同步右侧 AI 面板「提取角色」列表（若该角色还在列表中则移除）
        useAnalysisStore.getState().removeCharactersByName(character.name);
        // 重新拉取服务端数据，从列表移除该卡片
        router.refresh();
      } else {
        addToast(result.error, "error");
      }
    } catch {
      addToast("删除失败，请稍后重试", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="group/card relative rounded-2xl border-border/60 bg-card p-4 shadow-sm">
      {/* 删除按钮：悬浮卡片时显示 */}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`删除角色 ${character.name}`}
              className="absolute top-2 right-2 h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/card:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除角色</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除角色【{character.name}】？此操作不可恢复，相关出场记录也将被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogTrigger
              render={<Button variant="outline" size="sm" disabled={deleting} />}
            >
              取消
            </AlertDialogTrigger>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={handleDelete}
                />
              }
            >
              {deleting ? "删除中…" : "删除"}
            </AlertDialogTrigger>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">
          {initials(character.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{character.name}</p>
          {character.description && (
            <p className="truncate text-xs text-muted-foreground">
              {character.description.split("\n")[0]}
            </p>
          )}
        </div>
      </div>

      {(character.traits?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {character.traits!.slice(0, 4).map((trait) => (
            <Badge
              key={trait}
              variant="outline"
              className="px-1.5 py-0 text-[10px] font-normal"
            >
              {trait}
            </Badge>
          ))}
          {(character.traits?.length ?? 0) > 4 && (
            <Badge
              variant="ghost"
              className="px-1.5 py-0 text-[10px] font-normal"
            >
              +{character.traits!.length - 4}
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
});
