"use client";

import { CheckSquare, Loader2, Square, Trash2, UsersRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";

import { getCharacterDetail, type CharacterDetail } from "@/app/actions/characters";
import { deleteCharacter, deleteCharacters } from "@/app/actions/characters";
import { CharacterDetailModal } from "@/components/character/character-detail-modal";
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

import type { CharacterCardData } from "./page";

function initials(name: string) {
  return name.trim().slice(0, 1) || "?";
}

function CharacterCard({
  character,
  onClick,
  selected,
  onToggleSelect,
  selectionMode,
}: {
  character: CharacterCardData;
  onClick: () => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  selectionMode: boolean;
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
        useAnalysisStore.getState().removeCharactersByName(character.name);
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
    <Card className="group/card relative rounded-2xl border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* 删除按钮（仅在非选择模式下显示） */}
      {!selectionMode && (
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
      )}

      {/* 选择模式下的复选框 */}
      {selectionMode && (
        <button
          type="button"
          onClick={() => onToggleSelect(character.id)}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center"
        >
          {selected ? (
            <CheckSquare className="size-5 text-primary" />
          ) : (
            <Square className="size-5 text-muted-foreground" />
          )}
        </button>
      )}

      {/* 卡片主体（可点击查看详情 - 选择模式下点击切换选中） */}
      <button
        type="button"
        onClick={selectionMode ? () => onToggleSelect(character.id) : onClick}
        className="w-full text-left"
      >
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
      </button>
    </Card>
  );
}

export function CharactersPageClient({
  novelTitle,
  novelId,
  confirmed,
}: {
  novelTitle: string;
  novelId: string | null;
  confirmed: CharacterCardData[];
}) {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<CharacterDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 批量选择状态
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  const openDetail = async (characterId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetailOpen(true);
    try {
      const data = await getCharacterDetail(characterId);
      if (data) {
        setDetail(data);
        setDetailError(null);
      } else {
        setDetail(null);
        setDetailError("角色不存在或查询失败");
      }
    } catch (e) {
      setDetail(null);
      setDetailError(e instanceof Error ? e.message : "加载角色信息时发生未知错误");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleRefresh = () => {
    if (detail) {
      openDetail(detail.id);
    } else {
      setDetailError(null);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === confirmed.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(confirmed.map((c) => c.id)));
    }
  }, [confirmed, selectedIds.size]);

  const handleBatchDelete = async () => {
    if (batchDeleting || selectedIds.size === 0) return;
    setBatchDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await deleteCharacters(ids);
      if (result.ok) {
        addToast(`已批量删除 ${ids.length} 个角色`);
        // 从 AI 面板移除所有被删除的角色名
        const names = confirmed
          .filter((c) => selectedIds.has(c.id))
          .map((c) => c.name);
        names.forEach((name) =>
          useAnalysisStore.getState().removeCharactersByName(name),
        );
        setSelectedIds(new Set());
        setSelectionMode(false);
        router.refresh();
      } else {
        addToast(result.error, "error");
      }
    } catch {
      addToast("批量删除失败，请稍后重试", "error");
    } finally {
      setBatchDeleting(false);
      setBatchDeleteDialogOpen(false);
    }
  };

  if (!novelId) {
    return (
      <div className="mx-auto h-full max-w-4xl">
        <Card className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <UsersRound className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">暂无小说项目</p>
            <p className="mt-1 text-xs text-muted-foreground">
              创建小说并开始写作后，即可在此管理角色档案。
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const allSelected = confirmed.length > 0 && selectedIds.size === confirmed.length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">角色档案</h2>
          <p className="text-xs text-muted-foreground">
            《{novelTitle}》· 已确认角色 {confirmed.length} 个
          </p>
        </div>

        {/* 批量管理按钮 */}
        <div className="flex items-center gap-2">
          {selectionMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                }}
                className="gap-1.5 text-xs"
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setBatchDeleteDialogOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Trash2 className="size-3.5" />
                删除所选 ({selectedIds.size})
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="gap-1.5 text-xs"
            >
              <CheckSquare className="size-3.5" />
              批量管理
            </Button>
          )}
        </div>
      </div>

      {/* 选择模式下的操作栏 */}
      {selectionMode && confirmed.length > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <button
            type="button"
            onClick={selectAll}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="size-4 text-primary" />
            ) : (
              <Square className="size-4" />
            )}
            {allSelected ? "取消全选" : "全选"}
          </button>
          <span className="text-xs text-muted-foreground">
            已选 {selectedIds.size} / {confirmed.length}
          </span>
        </div>
      )}

      {/* 批量删除确认弹窗 */}
      <AlertDialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>批量删除角色</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除选中的 {selectedIds.size} 个角色？此操作不可恢复，相关出场记录也将被删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogTrigger
              render={<Button variant="outline" size="sm" disabled={batchDeleting} />}
            >
              取消
            </AlertDialogTrigger>
            <Button
              variant="destructive"
              size="sm"
              disabled={batchDeleting}
              onClick={handleBatchDelete}
            >
              {batchDeleting ? "删除中…" : `确认删除 (${selectedIds.size})`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {confirmed.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 rounded-2xl border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <UsersRound className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">该小说暂无已确认的角色</p>
            <p className="mt-1 text-xs text-muted-foreground">
              在编辑器中点击「分析本章」，AI 提取角色后确认入库即可显示在这里。
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {confirmed.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              onClick={() => openDetail(character.id)}
              selected={selectedIds.has(character.id)}
              onToggleSelect={toggleSelect}
              selectionMode={selectionMode}
            />
          ))}
        </div>
      )}

      <CharacterDetailModal
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetail(null);
            setDetailError(null);
          }
        }}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onRefresh={handleRefresh}
      />
    </div>
  );
}