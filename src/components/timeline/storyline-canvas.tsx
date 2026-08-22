"use client";

import "@xyflow/react/dist/style.css";

import { useTheme } from "@/hooks/use-theme";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { BookOpen, LayoutGrid, Sparkles } from "lucide-react";

import {
  addEventEdge,
  removeEventEdge,
  resetEventPositions,
  updateEventPosition,
} from "@/app/actions/events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToastStore } from "@/stores/toast-store";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  类型                                                               */
/* ------------------------------------------------------------------ */

export type TimelineEvent = {
  id: string;
  title: string;
  description: string | null;
  eventType: string | null;
  position: number;
  importance: number;
  chapterId: string | null;
  chapterTitle: string | null;
  /** main 主线 | branch 支线 */
  storyline: "main" | "branch";
  /** 已保存的拖拽位置（未保存时为 null，使用自动排列） */
  x: number | null;
  y: number | null;
  /** 手动连接的后续事件 id */
  outgoing: string[];
  relatedCharacters: { id: string | null; name: string }[];
};

type EventNodeData = { event: TimelineEvent; highlight: boolean };
type EventFlowNode = Node<EventNodeData, "event">;

/* ------------------------------------------------------------------ */
/*  布局常量                                                           */
/* ------------------------------------------------------------------ */

const NODE_WIDTH = 240;
const COL_GAP = 280;
const MAIN_Y = 40;
const BRANCH_Y = 260;
/** 每行最多事件数，超出则换行，避免故事线过长导致缩放过度 */
const MAX_EVENTS_PER_ROW = 12;
const ROW_GAP = 220;

/** 角色头像背景色（按名字哈希取色） */
const AVATAR_PALETTE = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/** 无保存位置时的自动排列：主线横排、支线在其下方一排，超出 MAX_EVENTS_PER_ROW 则换行 */
function autoLayout(eventsList: TimelineEvent[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  let mainCount = 0;
  let branchCount = 0;
  for (const ev of [...eventsList].sort((a, b) => a.position - b.position)) {
    if (ev.storyline === "branch") {
      const row = Math.floor(branchCount / MAX_EVENTS_PER_ROW);
      positions[ev.id] = { x: (branchCount % MAX_EVENTS_PER_ROW) * COL_GAP, y: BRANCH_Y + row * ROW_GAP };
      branchCount += 1;
    } else {
      const row = Math.floor(mainCount / MAX_EVENTS_PER_ROW);
      positions[ev.id] = { x: (mainCount % MAX_EVENTS_PER_ROW) * COL_GAP, y: MAIN_Y + row * ROW_GAP };
      mainCount += 1;
    }
  }
  return positions;
}

/* ------------------------------------------------------------------ */
/*  事件节点                                                           */
/* ------------------------------------------------------------------ */

function EventNode({ data, selected }: NodeProps<EventFlowNode>) {
  const { event, highlight } = data;
  const isMain = event.storyline === "main";
  const chars = event.relatedCharacters;

  return (
    <div
      className={cn(
        "group relative w-[240px] rounded-xl border-2 bg-card p-3 shadow-md transition-shadow",
        isMain
          ? "border-blue-500/60 hover:shadow-blue-500/20"
          : "border-violet-500/60 hover:shadow-violet-500/20",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        highlight && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-background !bg-muted-foreground"
      />
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug">
          {event.title}
        </p>
        {event.eventType && (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 px-1.5 py-0 text-[10px] font-normal",
              isMain ? "text-blue-500" : "text-violet-500",
            )}
          >
            {event.eventType}
          </Badge>
        )}
      </div>
      {event.description && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {event.description}
        </p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex -space-x-1.5">
          {chars.slice(0, 4).map((c) => (
            <div
              key={`${c.id ?? c.name}`}
              title={c.name}
              className={cn(
                "flex size-5 items-center justify-center rounded-full border border-background text-[10px] font-medium",
                avatarColor(c.name),
              )}
            >
              {c.name.slice(0, 1)}
            </div>
          ))}
          {chars.length > 4 && (
            <div className="flex size-5 items-center justify-center rounded-full border border-background bg-muted text-[9px] text-muted-foreground">
              +{chars.length - 4}
            </div>
          )}
          {chars.length === 0 && (
            <span className="text-[10px] text-muted-foreground">无关联角色</span>
          )}
        </div>
        <span className="truncate text-[10px] text-muted-foreground">
          {event.chapterTitle ?? ""}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-background !bg-muted-foreground"
      />
    </div>
  );
}

const nodeTypes = { event: EventNode };

/* ------------------------------------------------------------------ */
/*  主画布                                                             */
/* ------------------------------------------------------------------ */

export function StorylineCanvas({
  novelId,
  events: initialEvents,
  focusEventId,
  chapters,
}: {
  novelId: string;
  events: TimelineEvent[];
  focusEventId?: string | null;
  chapters: { id: string; title: string }[];
}) {
  const { mode } = useTheme();
  const isDark = mode === "dark";
  const addToast = useToastStore((s) => s.addToast);
  const reactFlow = useReactFlow();

  /* ---- 章节选择 ---- */
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  /* ---- 按章节过滤事件 ---- */
  const filteredEvents = useMemo(() => {
    if (!selectedChapterId) return initialEvents;
    return initialEvents.filter((e) => e.chapterId === selectedChapterId);
  }, [initialEvents, selectedChapterId]);

  const [nodes, setNodes, onNodesChange] = useNodesState<EventFlowNode>(
    filteredEvents.map((ev) => {
      const auto = autoLayout(filteredEvents);
      const pos =
        ev.x !== null && ev.y !== null
          ? { x: ev.x, y: ev.y }
          : (auto[ev.id] ?? { x: 0, y: 0 });
      return {
        id: ev.id,
        type: "event" as const,
        position: pos,
        data: { event: ev, highlight: false },
        deletable: false,
      };
    }),
  );

  /* ---- 章节切换时重建节点 ---- */
  useEffect(() => {
    const auto = autoLayout(filteredEvents);
    setNodes(
      filteredEvents.map((ev) => {
        const pos =
          ev.x !== null && ev.y !== null
            ? { x: ev.x, y: ev.y }
            : (auto[ev.id] ?? { x: 0, y: 0 });
        return {
          id: ev.id,
          type: "event" as const,
          position: pos,
          data: { event: ev, highlight: false },
          deletable: false,
        };
      }),
    );
  }, [filteredEvents, setNodes]);

  /* ---- 自动边：按时间顺序在同一故事线内依次连接 ---- */
  const autoEdges = useMemo(() => {
    const result: Edge[] = [];
    for (const line of ["main", "branch"] as const) {
      const lineEvents = [...filteredEvents]
        .filter((e) => e.storyline === line)
        .sort((a, b) => a.position - b.position);
      for (let i = 0; i < lineEvents.length - 1; i++) {
        const a = lineEvents[i];
        const b = lineEvents[i + 1];
        result.push({
          id: `auto-${a.id}-${b.id}`,
          source: a.id,
          target: b.id,
          type: "smoothstep",
          animated: line === "main",
          style: {
            stroke: line === "main" ? "#3b82f6" : "#8b5cf6",
            strokeWidth: 1.5,
            opacity: 0.65,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: line === "main" ? "#3b82f6" : "#8b5cf6",
          },
        });
      }
    }
    return result;
  }, [filteredEvents]);

  /* ---- 手动边：来自 events.data.outgoing ---- */
  const savedManualEdges = useMemo(() => {
    const result: Edge[] = [];
    for (const ev of filteredEvents) {
      for (const targetId of ev.outgoing) {
        if (!filteredEvents.some((e) => e.id === targetId)) continue;
        result.push({
          id: `m-${ev.id}-${targetId}`,
          source: ev.id,
          target: targetId,
          type: "smoothstep",
          style: { stroke: "#94a3b8", strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12 },
        });
      }
    }
    return result;
  }, [filteredEvents]);

  const [manualEdges, setManualEdges, onManualEdgesChange] =
    useEdgesState<Edge>(savedManualEdges);
  const combinedEdges = useMemo(
    () => [...autoEdges, ...manualEdges],
    [autoEdges, manualEdges],
  );

  /* ---- 边事件：仅处理手动边（m- 前缀） ---- */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onManualEdgesChange(
        changes.filter((c) => "id" in c && c.id.startsWith("m-")),
      );
    },
    [onManualEdgesChange],
  );

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    for (const edge of deleted) {
      if (!edge.id.startsWith("m-")) continue;
      void removeEventEdge(edge.source, edge.target);
    }
  }, []);

  /* ---- 手动拖拽连线 ---- */
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      const edgeId = `m-${connection.source}-${connection.target}`;
      if (manualEdges.some((e) => e.id === edgeId)) return;
      setManualEdges((eds) =>
        addEdge(
          {
            id: edgeId,
            source: connection.source!,
            target: connection.target!,
            type: "smoothstep",
            style: { stroke: "#94a3b8", strokeWidth: 1.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 12,
              height: 12,
            },
          },
          eds,
        ),
      );
      void addEventEdge(connection.source, connection.target);
    },
    [manualEdges, setManualEdges],
  );

  /* ---- 拖拽结束保存位置 ---- */
  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      void updateEventPosition(node.id, node.position.x, node.position.y);
    },
    [],
  );

  /* ---- 重置布局 ---- */
  const handleResetLayout = useCallback(async () => {
    const auto = autoLayout(filteredEvents);
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        position: auto[n.id] ?? n.position,
      })),
    );
    await resetEventPositions(novelId);
    addToast("已重置为自动布局");
  }, [filteredEvents, novelId, setNodes, addToast]);

  /* ---- 聚焦定位（编辑器「在故事线中查看」跳转带 focus 参数） ----
     注意：不要用 ref 做"只执行一次"守卫——dev StrictMode 会先运行 effect 再 cleanup
     再运行一次，守卫会导致第二次执行直接 return，清亮 timer 被第一次的 cleanup 清掉，
     高亮光圈永久残留。直接让每次 effect 都重新调度即可（幂等）。 */
  useEffect(() => {
    if (!focusEventId) return;
    // 等待画布渲染完成后居中到目标节点
    requestAnimationFrame(() => {
      reactFlow.fitView({
        nodes: [{ id: focusEventId }],
        padding: 2,
        duration: 600,
        maxZoom: 1.5,
      });
    });
    setNodes((ns) =>
      ns.map((n) =>
        n.id === focusEventId ? { ...n, data: { ...n.data, highlight: true } } : n,
      ),
    );
    // 清除 URL 中的 focus 参数
    window.history.replaceState(null, "", "/workspace/timeline");
    const timer = setTimeout(() => {
      setNodes((ns) =>
        ns.map((n) =>
          n.data.highlight ? { ...n, data: { ...n.data, highlight: false } } : n,
        ),
      );
    }, 3500);
    return () => clearTimeout(timer);
  }, [focusEventId, reactFlow, setNodes]);

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden rounded-xl border border-border/70 bg-card/40">
      <ReactFlow
        nodes={nodes}
        edges={combinedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={onEdgesDelete}
        deleteKeyCode={["Delete", "Backspace"]}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1.5}
          color={isDark ? "rgba(148,163,184,0.28)" : "rgba(100,116,139,0.3)"}
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) =>
            (n.data as EventNodeData).event.storyline === "branch"
              ? "#8b5cf6"
              : "#3b82f6"
          }
          className="!bg-card/80"
        />

        <Panel position="top-left" className="flex items-center gap-3">
          {/* 章节选择器 */}
          <div className="flex items-center gap-1.5">
            <BookOpen className="size-3.5 text-muted-foreground" />
            <Select
              value={selectedChapterId ?? "all"}
              onValueChange={(v) => setSelectedChapterId(v === "all" ? null : v)}
            >
              <SelectTrigger className="h-7 w-[140px] rounded-lg border-border/60 px-2 text-[11px]">
                <SelectValue placeholder="全部章节" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">全部章节</SelectItem>
                {chapters.map((ch) => (
                  <SelectItem key={ch.id} value={ch.id}>
                    {ch.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {filteredEvents.length} 个事件
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-blue-500" /> 主线
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full bg-violet-500" /> 支线
          </span>
        </Panel>

        <Panel position="top-right">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetLayout}
            className="h-7 gap-1.5 rounded-lg text-[11px]"
          >
            <LayoutGrid className="size-3" />
            重新排列
          </Button>
        </Panel>

        <Panel position="bottom-center">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="size-3" />
            拖拽节点调整位置 · 从节点右侧小圆点拖出连线可手动建立因果边 · 选中手动边后按 Delete 删除
          </p>
        </Panel>
      </ReactFlow>
    </div>
  );
}
