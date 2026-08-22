import { GitBranch } from "lucide-react";
import { asc, eq } from "drizzle-orm";

import { ClientOnly } from "@/components/client-only-wrapper";
import StorylineCanvasLazy from "@/components/timeline/storyline-canvas-lazy";
import type { TimelineEvent } from "@/components/timeline/storyline-canvas";
import { Card } from "@/components/ui/card";
import { chapters, characters, events, novels } from "@/db/schema";
import { db } from "@/db";

export const dynamic = "force-dynamic";

type EventData = {
  x?: number;
  y?: number;
  storyline?: string;
  outgoing?: string[];
  relatedNames?: string[];
};

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; novelId?: string }>;
}) {
  const { focus, novelId: paramNovelId } = await searchParams;

  let novelTitle = "";
  let novelId: string | null = null;
  let timelineEvents: TimelineEvent[] = [];
  let chapterRows: { id: string; title: string | null }[] = [];

  try {
    // 优先使用 URL 参数中的 novelId，否则取第一部小说
    let novel;
    if (paramNovelId) {
      novel = await db.query.novels.findFirst({
        where: eq(novels.id, paramNovelId),
        columns: { id: true, title: true },
      });
    }
    if (!novel) {
      novel = await db.query.novels.findFirst({
        orderBy: asc(novels.createdAt),
        columns: { id: true, title: true },
      });
    }

    if (novel) {
      novelId = novel.id;
      novelTitle = novel.title;

      const [eventRows, charRows] = await Promise.all([
        db.query.events.findMany({
          where: eq(events.novelId, novel.id),
          orderBy: asc(events.position),
        }),
        db.query.characters.findMany({
          where: eq(characters.novelId, novel.id),
          columns: { id: true, name: true },
        }),
        db.query.chapters.findMany({
          where: eq(chapters.novelId, novel.id),
          columns: { id: true, title: true },
        }),
      ]).then(([e, ch, cp]) => {
        chapterRows = cp;
        return [e, ch] as const;
      });

      const charMap = new Map(charRows.map((c) => [c.id, c.name]));
      const chapterMap = new Map(
        chapterRows.map((c) => [c.id, c.title ?? "未命名章节"]),
      );

      timelineEvents = eventRows.map((ev) => {
        const d = (ev.data ?? {}) as EventData;
        const relatedCharacters: { id: string | null; name: string }[] = [];
        for (const cid of ev.relatedCharacterIds ?? []) {
          const name = charMap.get(cid);
          if (name) relatedCharacters.push({ id: cid, name });
        }
        for (const name of d.relatedNames ?? []) {
          if (!relatedCharacters.some((r) => r.name === name)) {
            relatedCharacters.push({ id: null, name });
          }
        }
        return {
          id: ev.id,
          title: ev.title,
          description: ev.description,
          eventType: ev.eventType,
          position: ev.position,
          importance: ev.importance ?? 3,
          chapterId: ev.chapterId,
          chapterTitle: ev.chapterId ? chapterMap.get(ev.chapterId) ?? null : null,
          storyline: d.storyline === "branch" ? ("branch" as const) : ("main" as const),
          x: typeof d.x === "number" ? d.x : null,
          y: typeof d.y === "number" ? d.y : null,
          outgoing: d.outgoing ?? [],
          relatedCharacters,
        };
      });
    }
  } catch {
    // 数据库不可用，展示空状态
  }

  if (!novelId) {
    return (
      <div className="mx-auto h-full max-w-4xl">
        <Card className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <GitBranch className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">暂无小说项目</p>
            <p className="mt-1 text-xs text-muted-foreground">
              创建小说并开始写作后，即可在此查看剧情事件的故事线。
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">故事线</h2>
          <p className="text-xs text-muted-foreground">
            《{novelTitle}》· 事件 {timelineEvents.length} 个
          </p>
        </div>
      </div>

      {timelineEvents.length === 0 ? (
        <Card className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
            <GitBranch className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium">该小说暂无故事线数据</p>
            <p className="mt-1 text-xs text-muted-foreground">
              请先分析章节提取事件，剧情节点会自动出现在这里，形成可拖拽的故事线。
            </p>
          </div>
        </Card>
      ) : (
        <ClientOnly>
          <StorylineCanvasLazy
            novelId={novelId}
            events={timelineEvents}
            focusEventId={focus}
            chapters={chapterRows.map((c) => ({ id: c.id, title: c.title ?? "未命名章节" }))}
          />
        </ClientOnly>
      )}
    </div>
  );
}