"use client";

import { Loader2, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { createNovel } from "@/app/actions/novels";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/stores/toast-store";

interface CreateNovelDialogProps {
  children?: (openDialog: () => void) => ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateNovelDialog({
  children,
  open: controlledOpen,
  onOpenChange,
}: CreateNovelDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen! : uncontrolledOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setUncontrolledOpen(next);
    }
    if (!next) setTitle("");
  };

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const result = await createNovel(trimmed);
      if (result) {
        setOpen(false);
        setTitle("");
        addToast(`小说《${result.title}》创建成功`);
        window.location.href = `/novels/${result.id}/editor?chapter=${result.firstChapterId}`;
      } else {
        addToast("创建小说失败", "error");
      }
    } catch {
      addToast("创建小说失败", "error");
    } finally {
      setCreating(false);
    }
  };

  const openDialog = () => {
    setTitle("");
    setOpen(true);
  };

  return (
    <>
      {children ? children(openDialog) : null}
      <Dialog
        open={open}
        onOpenChange={setOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建小说</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="请输入小说名称"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !creating && title.trim()) {
                void handleCreate();
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  创建中…
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  创建
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
