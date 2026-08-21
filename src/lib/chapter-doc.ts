/**
 * Tiptap JSON 文档工具：文本提取与场景拆分。
 * 供章节保存（chapters.ts）与 AI 分析（analysis.ts）复用。
 */

export type JsonNode = {
  type?: string;
  text?: string;
  content?: JsonNode[];
  [key: string]: unknown;
};

export type JsonDoc = { type: "doc"; content?: JsonNode[] };

/** 提取节点树中的纯文本（段落/标题后补换行） */
export function extractText(nodes: JsonNode[]): string {
  let text = "";
  const walk = (list: JsonNode[] | undefined) => {
    if (!list) return;
    for (const node of list) {
      if (node.type === "text" && typeof node.text === "string") {
        text += node.text;
      }
      walk(node.content);
      if (node.type === "paragraph" || node.type === "heading") {
        text += "\n";
      }
    }
  };
  walk(nodes);
  return text;
}

/**
 * 按 sceneBreak 分隔线拆分文档 JSON。
 * 返回的每个场景包含完整的 Tiptap 子文档（含分隔后的节点）。
 * 末尾的空内容（如文档末尾的空段落）会被过滤，避免产生空场景。
 */
export function splitScenes(doc: JsonDoc): JsonNode[][] {
  const result: JsonNode[][] = [];
  let current: JsonNode[] = [];

  const flush = () => {
    if (current.length > 0) {
      result.push(current);
      current = [];
    }
  };

  for (const node of doc.content ?? []) {
    if (node.type === "sceneBreak") {
      flush();
      continue;
    }
    current.push(node);
  }
  flush();

  return result.filter((nodes) => extractText(nodes).trim().length > 0);
}
