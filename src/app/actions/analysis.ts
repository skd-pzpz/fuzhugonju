"use server";

import { and, asc, eq } from "drizzle-orm";
import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  chapters,
  characterAppearances,
  characters,
  events,
  novels,
  scenes,
} from "@/db/schema";
import { db } from "@/db";
import { extractText, type JsonDoc } from "@/lib/chapter-doc";
import {
  buildModelCandidates,
  getModelInstance,
} from "@/lib/ai/server-config";
import type { AiProviderId } from "@/lib/ai/providers";
import type { AiModuleKey } from "@/lib/ai/modules";
import {
  CHAPTER_ANALYSIS_SYSTEM_PROMPT,
  buildChapterAnalysisPrompt,
  chapterAnalysisSchema,
  type ExtractedCharacter,
  type ExtractedEvent,
} from "@/lib/analysis";
import { robustJsonParse } from "@/lib/robust-json";

export type AnalysisSceneResult = {
  sceneIndex: number;
  sceneId: string | null;
  sceneTitle: string;
  characters: ExtractedCharacter[];
  events: ExtractedEvent[];
};

export type AnalyzeChapterResult =
  | { ok: true; scenes: AnalysisSceneResult[]; fallback?: { provider: string; reason: string }; modelInfo?: { provider: string; model: string } }
  | { ok: false; error: string; provider?: string };

/** 获取当前登录用户 ID，未登录则抛出异常 */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  return session.user.id;
}

/** 检查小说是否属于当前用户 */
async function requireNovelOwnership(novelId: string, userId: string): Promise<void> {
  const novel = await db.query.novels.findFirst({
    where: and(eq(novels.id, novelId), eq(novels.userId, userId)),
    columns: { id: true },
  });
  if (!novel) throw new Error("小说不存在或无权限");
}

/** 判断是否为 401/Auth 错误 */
function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("令牌") ||
    msg.includes("token") ||
    msg.includes("api key")
  );
}

/** 置信度 -> 出场重要程度（1-5） */
function confidenceToImportance(confidence: number): number {
  if (confidence >= 0.9) return 5;
  if (confidence >= 0.8) return 4;
  if (confidence >= 0.7) return 3;
  if (confidence >= 0.5) return 2;
  return 1;
}

/**
 * 分析章节：整章分析，提取所有角色与事件（不再按场景拆分逐个调用 AI）。
 * 模型使用模块「character_extraction」（角色提取）的独立配置。
 * ——智能多层 Key 回退：customKeys → env平台Key → 智谱兜底
 */
export async function analyzeChapter(
  novelId: string,
  chapterId: string,
): Promise<AnalyzeChapterResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "未登录" };
  }
  try {
    await requireNovelOwnership(novelId, userId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "无权限访问该小说" };
  }

  let chapter;
  try {
    chapter = await db.query.chapters.findFirst({
      where: and(eq(chapters.id, chapterId), eq(chapters.novelId, novelId)),
    });
  } catch (e) {
    return {
      ok: false,
      error: `数据库查询失败：${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!chapter) return { ok: false, error: "章节不存在" };

  // 提取整章全文文本
  let fullText = "";
  try {
    const doc = JSON.parse(chapter.content ?? "") as JsonDoc;
    fullText = extractText(doc.content ?? []);
  } catch {
    fullText = "";
  }
  const trimmed = fullText.trim();
  if (!trimmed) {
    return { ok: false, error: "章节内容为空，无法分析" };
  }

  // 构建候选模型列表（按优先级：目标 provider 的 customKeys → envKey → 智谱兜底）
  const candidates = await buildModelCandidates("character_extraction");
  if (candidates.length === 0) {
    return { ok: false, error: "未配置任何可用的 API Key，请在设置中检查配置" };
  }

  let data: z.infer<typeof chapterAnalysisSchema> | null = null;
  let usedProvider: AiProviderId | string = candidates[0].provider;
  let usedModel: string = candidates[0].modelName;
  let fallbackInfo: { provider: string; reason: string } | undefined;
  let lastErrorMsg = "";

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    try {
      console.log(
        `[AI Analysis] 尝试候选 ${i + 1}/${candidates.length}: provider=${c.provider}, model=${c.modelName}, keySource=${c.keySource}`,
      );
      const result = await apiCallWithTimeout(c.model, trimmed);
      data = result.object;
      usedProvider = c.provider;
      usedModel = c.modelName;
      if (i > 0) {
        const firstProvider =
          candidates[0].provider === "zhipu"
            ? "智谱"
            : candidates[0].provider === "deepseek"
              ? "DeepSeek"
              : candidates[0].provider;
        const reason = `${firstProvider} API 调用失败（${lastErrorMsg || "未知错误"}），已自动回退到 ${
          c.provider === "zhipu" ? "智谱" : c.provider === "deepseek" ? "DeepSeek" : c.provider
        } · ${c.modelName}`;
        fallbackInfo = { provider: c.provider as string, reason };
        console.log(`[AI Analysis] 回退成功：${reason}`);
      }
      break;
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message === "TIMEOUT"
            ? "调用超时"
            : error.message
          : String(error);
      lastErrorMsg = msg;
      console.warn(`[AI Analysis] 候选 ${i + 1} 失败 (${c.provider}/${c.modelName}): ${msg}`);
      if (i === candidates.length - 1) {
        if (msg === "TIMEOUT") {
          return { ok: false, error: "分析超时，章节内容较长，请稍后重试" };
        }
        const showMsg = msg.includes("fetch")
          ? "网络连接失败，请检查网络后重试"
          : `AI 分析失败：${msg}`;
        return { ok: false, error: showMsg, provider: c.provider as string };
      }
    }
  }

  if (!data) {
    return { ok: false, error: "分析失败：未获取到 AI 返回结果" };
  }
  const mergedCharacters = mergeDuplicateCharacters(data.characters || []);
  data = { ...data, characters: mergedCharacters };

  const scenesResult: AnalysisSceneResult[] = [
    {
      sceneIndex: 1,
      sceneId: null,
      sceneTitle: "整章分析",
      characters: data.characters
        .filter((c) => c.name && c.name.trim())
        .map((c) => ({
          ...c,
          name: c.name!.trim(),
          aliases: (c.aliases ?? []).filter(Boolean),
          personality_tags: (c.personality_tags ?? []).filter(Boolean),
        })),
      events: (data.events ?? [])
        .filter((e) => e.title && e.title.trim())
        .map((e) => ({
          ...e,
          title: e.title!.trim(),
          related_characters: (e.related_characters ?? []).filter(Boolean),
        })),
    },
  ];

  const totalCharacters = scenesResult.reduce(
    (sum, s) => sum + s.characters.length,
    0,
  );
  if (totalCharacters === 0 && scenesResult[0].events.length === 0) {
    return { ok: false, error: "未提取到任何角色或事件，请重试" };
  }

  await db
    .update(chapters)
    .set({ aiAnalysis: { scenes: scenesResult }, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId));

  await persistChapterEvents(novelId, chapterId, userId, scenesResult);

  revalidatePath(`/novels/${novelId}/editor`);
  revalidatePath("/workspace/timeline", "page");
  return {
    ok: true,
    scenes: scenesResult,
    modelInfo: { provider: usedProvider as string, model: usedModel },
    ...(fallbackInfo ? { fallback: fallbackInfo } : {}),
  };
}

/** 带超时保护的 API 调用：所有模型统一用 generateText（兼容 DeepSeek 这类不支持 response_format=json_object 的提供商） */
async function apiCallWithTimeout(
  model: ReturnType<typeof getModelInstance>,
  chapterText: string,
) {
  const textResult = await Promise.race([
    generateText({
      model,
      system: CHAPTER_ANALYSIS_SYSTEM_PROMPT,
      prompt: buildChapterAnalysisPrompt(chapterText),
      temperature: 0.1,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TIMEOUT")), 120_000),
    ),
  ]);
  const data = robustJsonParse(textResult.text, chapterAnalysisSchema);
  return { object: data, text: textResult.text };
}

/** 合并同名角色（同章内多个称呼要归并） */
function mergeDuplicateCharacters(
  characters: ExtractedCharacter[],
): ExtractedCharacter[] {
  const map = new Map<string, ExtractedCharacter>();
  for (const c of characters) {
    if (!c.name) continue;
    const key = c.name.trim().toLowerCase();
    if (!map.has(key)) {
      map.set(key, { ...c });
    } else {
      const existing = map.get(key)!;
      const mergedAliases = new Set([
        ...(existing.aliases ?? []),
        ...(c.aliases ?? []),
      ]);
      map.set(key, {
        ...existing,
        ...c,
        aliases: Array.from(mergedAliases),
        personality_tags: [
          ...new Set([
            ...(existing.personality_tags ?? []),
            ...(c.personality_tags ?? []),
          ]),
        ],
        occupation: c.occupation || existing.occupation,
        appearance: c.appearance || existing.appearance,
        background: c.background || existing.background,
      });
    }
  }
  return Array.from(map.values());
}

/**
 * 将分析出的所有事件写入 events 表：
 * 先删除该章节旧事件，再按全局顺序插入新事件；相关角色名解析为角色 id。
 */
async function persistChapterEvents(
  novelId: string,
  chapterId: string,
  userId: string,
  scenesResult: AnalysisSceneResult[],
) {
  const allEvents: { sceneIndex: number; event: ExtractedEvent }[] = [];
  for (const scene of scenesResult) {
    for (const event of scene.events) {
      if (event.title && event.title.trim()) {
        allEvents.push({ sceneIndex: scene.sceneIndex, event });
      }
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(events).where(eq(events.chapterId, chapterId));

    if (allEvents.length === 0) return;

    const chars = await tx.query.characters.findMany({
      where: eq(characters.novelId, novelId),
      columns: { id: true, name: true },
    });
    const nameToId = new Map(
      chars.map((c) => [c.name.trim().toLowerCase(), c.id] as const),
    );

    let position = 0;
    for (const { event } of allEvents) {
      const relatedNames = (event.related_characters ?? []).filter(Boolean);
      const relatedIds = relatedNames
        .map((name) => nameToId.get(name.trim().toLowerCase()))
        .filter((id): id is string => Boolean(id));
      await tx.insert(events).values({
        novelId,
        chapterId,
        userId,
        title: event.title!,
        description: event.description,
        eventType: event.eventType,
        position,
        importance: event.importance ?? 3,
        relatedCharacterIds: relatedIds.length > 0 ? relatedIds : null,
        data: {
          relatedNames,
          storyline: event.storyline ?? "main",
          source: "ai",
        },
      });
      position += 1;
    }
  });
}

/* ------------------------------------------------------------------ */
/*  角色确认入库                                                         */
/* ------------------------------------------------------------------ */

const confirmCharacterSchema = z.object({
  sceneId: z.string().nullable(),
  name: z.string().trim().min(1, "角色名不能为空"),
  aliases: z.array(z.string()).optional(),
  age: z.string().optional(),
  occupation: z.string().optional(),
  faction: z.string().optional(),
  traits: z.array(z.string()).optional(),
  appearance: z.string().optional(),
  distinctive_features: z.string().optional(),
  background: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type ConfirmCharacterInput = z.infer<typeof confirmCharacterSchema>;

/**
 * 确认角色入库：
 * 1. 按 (novelId, name) 去重，已存在则合并信息并更新，否则新建
 * 2. 在 character_appearances 写入该角色在对应场景的出场记录
 */
export async function confirmCharacter(
  novelId: string,
  input: ConfirmCharacterInput,
) {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  const parsed = confirmCharacterSchema.parse(input);
  const traits = parsed.traits ?? [];

  const descParts: string[] = [];
  if (parsed.occupation) descParts.push(`职业：${parsed.occupation}`);
  if (parsed.aliases?.length) descParts.push(`别名：${parsed.aliases.join("、")}`);
  const description = descParts.length > 0 ? descParts.join("\n") : undefined;

  const existing = await db.query.characters.findFirst({
    where: and(
      eq(characters.novelId, novelId),
      eq(characters.name, parsed.name),
    ),
  });

  let characterId: string | undefined = existing?.id;

  await db.transaction(async (tx) => {
    if (existing) {
      const mergedTraits = [...new Set([...(existing.traits ?? []), ...traits])];
      await tx
        .update(characters)
        .set({
          traits: mergedTraits,
          description: description || existing.description,
          age: parsed.age ?? existing.age,
          occupation: parsed.occupation ?? existing.occupation,
          faction: parsed.faction ?? existing.faction,
          appearance: parsed.appearance ?? existing.appearance,
          distinctiveFeatures:
            parsed.distinctive_features ?? existing.distinctiveFeatures,
          background: parsed.background ?? existing.background,
          source: "ai",
          isConfirmed: true,
          updatedAt: new Date(),
        })
        .where(eq(characters.id, existing.id));
    } else {
      const [created] = await tx
        .insert(characters)
        .values({
          novelId,
          userId,
          name: parsed.name,
          source: "ai",
          isConfirmed: true,
          traits,
          description,
          age: parsed.age,
          occupation: parsed.occupation,
          faction: parsed.faction,
          appearance: parsed.appearance,
          distinctiveFeatures: parsed.distinctive_features,
          background: parsed.background,
        })
        .returning({ id: characters.id });
      characterId = created?.id;
    }

    if (characterId && parsed.sceneId) {
      await tx
        .insert(characterAppearances)
        .values({
          novelId,
          characterId,
          sceneId: parsed.sceneId,
          mentionType: "ai",
          importance: confidenceToImportance(parsed.confidence),
        })
        .onConflictDoNothing();
    }
  });

  revalidatePath(`/novels/${novelId}/editor`);
  return { ok: true, characterId };
}

/* ------------------------------------------------------------------ */
/*  AI 错字检测                                                         */
/* ------------------------------------------------------------------ */

const spellCheckIssueSchema = z.object({
  original: z.string(),
  suggestion: z.string(),
  reason: z.string(),
});

const spellCheckResponseSchema = z.object({
  issues: z.array(spellCheckIssueSchema),
});

export type SpellCheckIssue = z.infer<typeof spellCheckIssueSchema>;

export type SpellCheckResult =
  | { ok: true; issues: SpellCheckIssue[] }
  | { ok: false; error: string };

/**
 * AI 错字检测：读取当前章节全文，调用 AI 检查错别字、语法错误、标点误用。
 * 使用轻量模型 glm-4-flash（任务简单，快速返回）。
 */
export async function checkSpelling(
  novelId: string,
  chapterId: string,
): Promise<SpellCheckResult> {
  const userId = await requireUserId();
  await requireNovelOwnership(novelId, userId);

  const candidates = await buildModelCandidates("character_extraction");
  if (candidates.length === 0) {
    return { ok: false, error: "未配置任何可用的 API Key，请在设置中检查配置" };
  }

  const chapter = await db.query.chapters.findFirst({
    where: and(eq(chapters.id, chapterId), eq(chapters.novelId, novelId)),
  });
  if (!chapter) return { ok: false, error: "章节不存在" };

  const parsed = JSON.parse(chapter.content ?? "{}") as JsonDoc;
  const text = extractText(parsed.content ?? []);
  const truncated = text.length > 8000
    ? text.slice(0, 8000) + "\n\n（以下内容已截断）"
    : text;

  const systemPrompt = `你是一位专业的文字校对编辑。请检查用户提供的文本，找出其中的错别字、语法错误、标点误用等问题。

请以 JSON 格式输出，格式如下：
{
  "issues": [
    {
      "original": "原文中有问题的片段",
      "suggestion": "建议修改后的内容",
      "reason": "错误原因（如：错别字、语法错误、标点误用等）"
    }
  ]
}

如果没有发现问题，返回 { "issues": [] }。只输出 JSON，不要其他内容。`;
  const userPrompt = `请检查以下小说文本中的错别字、语法错误、标点误用：\n\n${truncated}`;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    try {
      console.log(
        `[SpellCheck] 尝试候选 ${i + 1}/${candidates.length}: provider=${c.provider}, model=${c.modelName}, keySource=${c.keySource}`,
      );
      const textResult = await Promise.race([
        generateText({
          model: c.model,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.1,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), 90_000),
        ),
      ]);
      const parsed = robustJsonParse(textResult.text, spellCheckResponseSchema);
      return { ok: true, issues: parsed.issues };
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message === "TIMEOUT"
            ? "检测超时"
            : error.message
          : String(error);
      console.warn(`[SpellCheck] 候选 ${i + 1} 失败 (${c.provider}/${c.modelName}): ${msg}`);
      if (i === candidates.length - 1) {
        if (msg === "TIMEOUT") {
          return { ok: false, error: "检测超时，内容较长，请稍后重试" };
        }
        return { ok: false, error: `错字检测失败：${msg}` };
      }
    }
  }
  return { ok: false, error: "错字检测失败" };
}