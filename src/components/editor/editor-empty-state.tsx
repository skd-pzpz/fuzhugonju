"use client";

import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { CreateNovelDialog } from "@/components/layout/create-novel-dialog";

export function EditorEmptyState() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <CreateNovelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
      <Card className="w-full max-w-[480px] flex flex-col rounded-2xl border-dashed border-border bg-card/50 px-10 py-16 text-center">
        <CardHeader className="items-center justify-items-center gap-6 pb-0">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20">
            <BookOpen className="size-7" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-foreground whitespace-nowrap">
              开始你的第一本小说
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              创建小说项目后，即可进入富文本编辑器进行创作。
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-8 text-center">
          <Button
            onClick={() => setDialogOpen(true)}
            size="lg"
            className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 px-6"
          >
            <Plus />
            新建小说
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
