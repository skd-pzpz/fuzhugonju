import { z } from "zod";

/**
 * AI 提取的角色信息 Schema。
 * 由 generateObject 直接用于结构化输出与校验。
 */
export const extractedCharacterSchema = z.object({
  name: z.string().describe("角色的正式姓名或主要称呼，必须是专有名词（如'林晚'、'苏娘'），不能是职位或身份描述。如果文本中只有职位称呼（如'副队长'）而没有具体人名，则填职位名。"),
  /** 别名 / 曾用名 / 绰号 */
  aliases: z.array(z.string()).optional(),
  /** 年龄（不确定可为空），如'25岁'或'约三十岁' */
  age: z.string().optional(),
  /** 职业 / 身份 / 职位，如'程序员'、'酒馆老板娘'、'副队长'。注意：职位类名称应放在此处，而不是 name 字段 */
  occupation: z.string().optional(),
  /** 所属阵营、势力或组织 */
  faction: z.string().optional(),
  /** 性格标签，如沉稳、急躁、腹黑 */
  personality_tags: z.array(z.string()).optional(),
  /** 外貌特征描述 */
  appearance: z.string().optional(),
  /** 显著外貌特征，如疤痕、特殊发型 */
  distinctive_features: z.string().optional(),
  /** 出身背景 */
  background: z.string().optional(),
  /** 关键经历 */
  key_events: z.array(z.string()).optional(),
  /** 与主角的关系 */
  protagonist_relation: z.string().optional(),
  /** 社交倾向 */
  social_tendency: z.string().optional(),
  /** 故事开始时的状态 */
  initial_state: z.string().optional(),
  /** 角色变化方向 */
  arc_direction: z.string().optional(),
  /** 故事结束时的状态 */
  final_state: z.string().optional(),
  /** 灵感来源 */
  inspiration: z.string().optional(),
  /** 作者备注 */
  author_notes: z.string().optional(),
  /** 提取置信度 0-1，信息不完整时应低于 0.7 */
  confidence: z.number().min(0).max(1),
});

/**
 * AI 提取的事件 Schema（用于故事线可视化）。
 * storyline：主线 main / 支线 branch。
 */
export const extractedEventSchema = z.object({
  title: z.string().describe("事件标题，如'玉佩的秘密'"),
  /** 事件概要（2-3 句话） */
  description: z.string().optional(),
  /** 转折点 / 冲突 / 解决 / 伏笔 ... */
  eventType: z.string().optional(),
  /** main 主线 | branch 支线 */
  storyline: z.enum(["main", "branch"]).optional(),
  /** 涉及的角色名（应与本场景 characters 中的名字一致） */
  related_characters: z.array(z.string()).optional(),
  /** 重要程度 1-5 */
  importance: z.number().min(1).max(5).optional(),
});

export const sceneAnalysisSchema = z.object({
  characters: z.array(extractedCharacterSchema),
  events: z.array(extractedEventSchema).optional(),
});

/** 整章分析结果 Schema */
export const chapterAnalysisSchema = z.object({
  characters: z.array(extractedCharacterSchema),
  events: z.array(extractedEventSchema).optional(),
});

export type ExtractedCharacter = z.infer<typeof extractedCharacterSchema>;
export type ExtractedEvent = z.infer<typeof extractedEventSchema>;

/** 整章分析系统提示词 */
export const CHAPTER_ANALYSIS_SYSTEM_PROMPT = `你是一名资深小说编辑与人物设定分析师。你的任务是阅读用户提供的完整小说章节，提取其中所有出现或提及的角色信息，以及该章节中发生的关键事件。

【角色要求】
1. 仔细阅读整章内容，不要遗漏任何角色。即使是只出现一次的角色也要提取。
2. 如果角色在章内有多个称呼（如"副队长陈晓明"和"陈晓明"），统一归为一个角色，name 填正式姓名，aliases 填其他称呼。
3. 对每个角色尽量提取完整信息；信息在原文中不明确时留空，并把 confidence 调低（低于 0.7）。
4. personality_tags 用 2-5 个简短中文标签概括性格（如：冷静、重情义、固执）。
5. appearance 摘录原文中外貌描写（如有）。
6. background 摘录原文中体现角色背景/经历/来历的句子（原文摘录，不要改写，控制在 60 字以内）。

【重要：姓名 vs 职业区分规则】
- 如果文本中同时出现职位+姓名（如"副队长陈晓明"），name 必须是"陈晓明"，occupation 必须是"副队长"
- 如果文本中只有职位称呼（如"副队长走了过来"）而没有具体人名，则 name 填"副队长"，occupation 也填"副队长"
- 绝对不能把职位填到 name 字段而把真实姓名漏掉

【示例】
示例 1：
文本："副队长陈晓明走了过来"
正确提取：
- name: "陈晓明"
- occupation: "副队长"
- 错误示范：name 不能填"副队长"

示例 2：
文本："酒馆老板娘苏娘端来一碗热汤"
正确提取：
- name: "苏娘"
- occupation: "酒馆老板娘"

【事件要求】
1. 提取该章节中真实发生、影响剧情走向的关键事件（一般 1-5 个），不要凭空编造，也不要提取琐碎日常。
2. title 用简短短语概括事件（如：玉佩的秘密）。
3. description 用 2-3 句话描述事件经过与影响。
4. eventType 从「转折点 / 冲突 / 解决 / 伏笔 / 进展」中选一个最贴切的。
5. storyline 判断该事件属于主线（main，推动核心情节）还是支线（branch，次要情节或铺垫）。
6. related_characters 列出事件涉及的角色名，必须与 characters 中的名字保持一致。
7. importance 用 1-5 表示事件重要程度。

只输出 JSON，不要输出任何解释文字。

输出格式：
{
  "characters": [
    {
      "name": "角色名（必须是专有名词，不能是职位/身份描述）",
      "aliases": ["别名1"],
      "age": "年龄或空",
      "occupation": "职业/身份或空（如：副队长、酒馆老板娘）",
      "faction": "所属阵营或空",
      "personality_tags": ["标签1", "标签2"],
      "appearance": "外貌描写摘录或空",
      "distinctive_features": "显著特征或空",
      "background": "背景经历原文摘录或空",
      "key_events": ["关键经历1"],
      "protagonist_relation": "与主角的关系或空",
      "confidence": 0.85
    }
  ],
  "events": [
    {
      "title": "事件标题",
      "description": "事件概要 2-3 句话",
      "eventType": "转折点",
      "storyline": "main",
      "related_characters": ["角色名"],
      "importance": 4
    }
  ]
}`;

/** 构建整章分析 Prompt */
export function buildChapterAnalysisPrompt(chapterContent: string): string {
  // 截断过长文本（限制 8000 字，避免超出模型上下文）
  const truncated =
    chapterContent.length > 8000
      ? chapterContent.slice(0, 8000) + "\n\n（以下内容已截断）"
      : chapterContent;

  return `请分析以下完整章节内容，提取所有角色信息和关键事件。

要求：
1. 仔细阅读整章内容，不要遗漏任何角色
2. 即使是只出现一次的角色也要提取
3. 如果角色在章内有多个称呼（如"副队长陈晓明"和"陈晓明"），统一归为一个角色
4. 职业/职位必须填入 occupation 字段，不能填入 name 字段
5. 严格按输出格式返回 JSON，不要输出其他文字

【JSON 格式注意事项】
- 只输出纯 JSON 文本
- 不要输出 markdown 代码块标记（如 \`\`\`json 或 \`\`\`）
- 不要在 JSON 前后加任何文字说明或注释
- 不要输出示例，直接输出章节内容的分析结果

章节内容：
"""
${truncated}
"""`;
}

/** 分析系统提示词（旧版，按场景分析，保留兼容） */
export const ANALYSIS_SYSTEM_PROMPT = `你是一名资深小说编辑与人物设定分析师。你的任务是阅读用户提供的小说章节片段（可能是单个场景），提取其中出现或提及的角色信息，以及该场景中发生的关键事件。

【角色要求】
1. 只提取该片段中真实出现、被明确提及或推动剧情的角色，不要凭空编造。
2. 对每个角色尽量提取完整信息；信息在原文中不明确时留空，并把 confidence 调低（低于 0.7）。
3. personality_tags 用 2-5 个简短中文标签概括性格（如：冷静、重情义、固执）。
4. appearance 摘录原文中外貌描写（如有）。
5. background 摘录原文中体现角色背景/经历/来历的句子（原文摘录，不要改写，控制在 60 字以内）。

【重要：姓名 vs 职业区分规则】
- 如果文本中同时出现职位+姓名（如"副队长陈晓明"），name 必须是"陈晓明"，occupation 必须是"副队长"
- 如果文本中只有职位称呼（如"副队长走了过来"）而没有具体人名，则 name 填"副队长"，occupation 也填"副队长"
- 绝对不能把职位填到 name 字段而把真实姓名漏掉

【示例】
示例 1：
文本："副队长陈晓明走了过来"
正确提取：
- name: "陈晓明"
- occupation: "副队长"
- 错误示范：name 不能填"副队长"

示例 2：
文本："酒馆老板娘苏娘端来一碗热汤"
正确提取：
- name: "苏娘"
- occupation: "酒馆老板娘"

示例 3：
文本："凌幽梦感受着秦珺瑶的气息"
正确提取：
- name: "凌幽梦"
- occupation: null（文中未提及职业）

【事件要求】
1. 只提取该场景中真实发生、影响剧情走向的关键事件（一般 0-3 个），不要凭空编造，也不要提取琐碎日常。
2. title 用简短短语概括事件（如：玉佩的秘密）。
3. description 用 2-3 句话描述事件经过与影响。
4. eventType 从「转折点 / 冲突 / 解决 / 伏笔 / 进展」中选一个最贴切的。
5. storyline 判断该事件属于主线（main，推动核心情节）还是支线（branch，次要情节或铺垫）。
6. related_characters 列出事件涉及的角色名，必须与 characters 中的名字保持一致。
7. importance 用 1-5 表示事件重要程度。

只输出 JSON，不要输出任何解释文字。

输出格式：
{
  "characters": [
    {
      "name": "角色名（必须是专有名词，不能是职位/身份描述）",
      "aliases": ["别名1"],
      "age": "年龄或空",
      "occupation": "职业/身份或空（如：副队长、酒馆老板娘）",
      "faction": "所属阵营或空",
      "personality_tags": ["标签1", "标签2"],
      "appearance": "外貌描写摘录或空",
      "distinctive_features": "显著特征或空",
      "background": "背景经历原文摘录或空",
      "key_events": ["关键经历1"],
      "protagonist_relation": "与主角的关系或空",
      "confidence": 0.85
    }
  ],
  "events": [
    {
      "title": "事件标题",
      "description": "事件概要 2-3 句话",
      "eventType": "转折点",
      "storyline": "main",
      "related_characters": ["角色名"],
      "importance": 4
    }
  ]
}`;