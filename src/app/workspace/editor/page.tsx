import { redirect } from "next/navigation";

import { EditorEmptyState } from "@/components/editor/editor-empty-state";
import { novels } from "@/db/schema";
import { db } from "@/db";
import { asc } from "drizzle-orm";

export default async function EditorPage() {
  let firstNovel: { id: string } | undefined;
  try {
    firstNovel = await db.query.novels.findFirst({
      orderBy: asc(novels.createdAt),
      columns: { id: true },
    });
  } catch {
    // 数据库不可用，展示空状态
  }

  if (firstNovel) {
    redirect(`/novels/${firstNovel.id}/editor`);
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <EditorEmptyState />
    </div>
  );
}
