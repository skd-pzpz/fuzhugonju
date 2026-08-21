"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from "@tiptap/react";
import { Scissors, X } from "lucide-react";

/**
 * 场景分隔节点视图：
 * - 渲染一条视觉分隔线，中间带有「场景 X」标签（X 根据文档顺序自动计算）
 * - 悬浮时可删除
 */
function SceneBreakView({ editor, getPos, deleteNode }: NodeViewProps) {
  const sceneIndex = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return 1;
      const currentPos = getPos();
      if (currentPos === undefined) return 1;
      let index = 1;
      e.state.doc.descendants((node, nodePos) => {
        if (node.type.name === "sceneBreak" && nodePos < currentPos) {
          index += 1;
        }
        return true;
      });
      return index;
    },
  });

  return (
    <NodeViewWrapper
      as="div"
      data-scene-break="true"
      className="group/scene relative my-7 select-none"
    >
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-border/80" />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3.5 py-1 text-xs font-medium text-muted-foreground">
          <Scissors className="size-3 text-primary" />
          场景 {sceneIndex}
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-border/80" />
      </div>

      {/* 删除按钮（悬浮显示） */}
      <button
        type="button"
        onClick={deleteNode}
        aria-label={`删除场景分隔线 ${sceneIndex}`}
        className="absolute -right-1 -top-3 flex size-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover/scene:opacity-100"
      >
        <X className="size-3" />
      </button>
    </NodeViewWrapper>
  );
}

/**
 * 自定义 Tiptap 节点：sceneBreak（场景分隔线）
 */
export const SceneBreak = Node.create({
  name: "sceneBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: "div[data-scene-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-scene-break": "true" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SceneBreakView);
  },
});
