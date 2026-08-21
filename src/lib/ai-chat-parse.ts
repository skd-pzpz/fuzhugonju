/**
 * 解析 AI 对话响应中的结构化内容：
 * - 卡文建议 → 3 个续写方向卡片
 * - 角色行为 → 3 个反应选项卡片
 * 解析失败时返回空数组，由前端回退为纯 Markdown 渲染。
 */

/* ------------------------------------------------------------------ */
/*  卡文建议：续写方向                                                  */
/* ------------------------------------------------------------------ */

export type WriterDirection = {
  title: string;
  summary: string;
  characters: string;
  mood: string;
  /** 完整原文（含标题行），用于「采用此方向」插入编辑器 */
  raw: string;
};

/** 提取 `**标签**：内容` 字段 */
function extractField(section: string, label: string): string {
  const match = section.match(
    new RegExp(`\\*{0,2}${label}\\*{0,2}\\s*[：:]([^\\n]+)`),
  );
  return match ? match[1].trim() : "";
}

export function parseWriterDirections(text: string): WriterDirection[] {
  // 按 "方向" 标题切分（兼容 ## / ### 级别）
  const sections = text.split(/\n(?=#{1,4}\s*方向)/g);
  const result: WriterDirection[] = [];

  for (const section of sections) {
    const titleMatch = section.match(/#{1,4}\s*(方向[^\n]*)/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    const summary = extractField(section, "情节概要");
    if (!summary) continue;
    result.push({
      title,
      summary,
      characters: extractField(section, "涉及的角色"),
      mood: extractField(section, "情绪走向"),
      raw: section.replace(/^#{1,4}\s*/, "").trim(),
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  角色行为：反应选项                                                  */
/* ------------------------------------------------------------------ */

export type CharacterReactionLabel = "符合性格" | "情理之中" | "突破常规";

export type CharacterReaction = {
  label: CharacterReactionLabel;
  title: string;
  content: string;
  reason: string;
  raw: string;
};

const REACTION_LABELS: CharacterReactionLabel[] = [
  "符合性格",
  "情理之中",
  "突破常规",
];

export function parseCharacterReactions(
  text: string,
): CharacterReaction[] {
  // 按 "【符合性格】" 等标题切分
  const sections = text.split(/\n(?=#{1,4}\s*【)/g);
  const result: CharacterReaction[] = [];

  for (const section of sections) {
    const titleMatch = section.match(/#{1,4}\s*【([^】]+)】\s*(.*)/);
    if (!titleMatch) continue;
    const label = REACTION_LABELS.find((l) =>
      titleMatch[1].includes(l),
    );
    if (!label) continue;

    // 标题行剩余部分（若有）
    const title = titleMatch[2].trim();
    // 提取 "**为什么这样：**" / "为什么这样：" 解释
    const reasonMatch = section.match(
      /(?:\*\*)?为什么(?:这个角色)?(?:会)?这样做(?:\*\*)?\s*[：:]([^\n]+)/,
    );
    const reason = reasonMatch ? reasonMatch[1].trim() : "";
    // 去掉标题行与原因行，剩余为内容描述
    const content = section
      .replace(/^#{1,4}\s*【[^】]+】[^\n]*\n?/, "")
      .replace(/(?:\*\*)?为什么(?:这个角色)?(?:会)?这样做(?:\*\*)?\s*[：:][^\n]*\n?/g, "")
      .replace(/^[-*]\s*/gm, "")
      .trim();

    result.push({
      label,
      title,
      content,
      reason,
      raw: section.replace(/^#{1,4}\s*/, "").trim(),
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  通用：Markdown 去格式化（插入编辑器时用）                            */
/* ------------------------------------------------------------------ */

/** 去掉 Markdown 语法符号，转成纯文本 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s*/g, "") // 标题
    .replace(/\*\*([^*]+)\*\*/g, "$1") // 加粗
    .replace(/\*([^*]+)\*/g, "$1") // 斜体
    .replace(/`([^`]+)`/g, "$1") // 行内代码
    .replace(/^[-*]\s+/gm, "") // 无序列表
    .replace(/^\d+[.、]\s+/gm, "") // 有序列表
    .replace(/^>\s?/gm, "") // 引用
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // 链接
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
