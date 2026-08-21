import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  generateText,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { characters, relationships, scenes } from "@/db/schema";
import { extractText, type JsonDoc } from "@/lib/chapter-doc";
import {
  buildModelCandidates,
  getModelInstance,
  resolveAiConfig,
  type ModelCandidate,
} from "@/lib/ai/server-config";
import type { AiModuleKey } from "@/lib/ai/modules";
import {
  CHARACTER_ADVICE_SYSTEM,
  GENERAL_SYSTEM,
  WRITER_BLOCK_SYSTEM,
} from "@/lib/ai-prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMode = "general" | "writer_block" | "character_advice";

/* ------------------------------------------------------------------ */
/*  上下文构建                                                          */
/* ------------------------------------------------------------------ */

/** 取 UI 消息的纯文本（v7 消息内容在 parts 中） */
function getUIMessageText(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => (part as { text?: string }).text ?? "")
    .join("");
}

/** 读取章节最近 2 个场景的纯文本（按顺序正排） */
async function getRecentScenesText(
  chapterId?: string | null,
): Promise<string> {
  if (!chapterId) return "";
  const list = await db.query.scenes.findMany({
    where: eq(scenes.chapterId, chapterId),
    orderBy: desc(scenes.order),
    limit: 2,
  });

  const parts: string[] = [];
  for (const scene of [...list].reverse()) {
    let text = "";
    try {
      const doc = JSON.parse(scene.content ?? "") as JsonDoc;
      text = extractText(doc.content ?? []);
    } catch {
      text = "";
    }
    const trimmed = text.trim();
    if (trimmed) {
      parts.push(`【${scene.title ?? `场景 ${scene.order}`}】\n${trimmed}`);
    }
  }
  return parts.join("\n\n");
}

/** 从用户消息解析角色名（优先匹配小说内已知角色） */
async function resolveCharacterName(
  novelId: string | null | undefined,
  lastUserText: string,
): Promise<string> {
  const trimmed = lastUserText.trim();
  if (!novelId) return trimmed;

  const list = await db.query.characters.findMany({
    where: eq(characters.novelId, novelId),
    columns: { name: true },
  });
  const names = list.map((c) => c.name).filter(Boolean);

  if (names.includes(trimmed)) return trimmed;
  const matched = names.find((name) => name && trimmed.includes(name));
  return matched ?? trimmed;
}

/** 构建角色档案文本（完整字段 + 关系网） */
async function getCharacterProfileText(
  novelId: string | null | undefined,
  name: string,
): Promise<string | null> {
  if (!novelId) return null;

  const character = await db.query.characters.findFirst({
    where: and(eq(characters.novelId, novelId), eq(characters.name, name)),
    with: {
      relationshipsAsA: {
        with: { characterB: { columns: { name: true } } },
      },
      relationshipsAsB: {
        with: { characterA: { columns: { name: true } } },
      },
    },
  });
  if (!character) return null;

  const lines: string[] = [];

  /* ---- 基础信息 ---- */
  lines.push(`【基础信息】姓名：${character.name}`);
  if (character.aliases?.length)
    lines.push(`别名/绰号：${character.aliases.join("、")}`);
  if (character.role) lines.push(`角色定位：${character.role}`);
  if (character.gender) lines.push(`性别：${character.gender}`);
  if (character.age) lines.push(`年龄：${character.age}`);
  if (character.occupation) lines.push(`职业/身份：${character.occupation}`);
  if (character.faction) lines.push(`阵营/势力：${character.faction}`);

  /* ---- 性格特征 ---- */
  const tags = character.personalityTags ?? character.traits;
  if (tags?.length)
    lines.push(`【性格】性格标签：${tags.join("、")}`);
  if (character.description) lines.push(`描述：${character.description}`);

  /* ---- 外貌特征 ---- */
  if (character.appearance) lines.push(`【外貌】外貌概述：${character.appearance}`);
  if (character.distinctiveFeatures)
    lines.push(`显著特征：${character.distinctiveFeatures}`);

  /* ---- 背景经历 ---- */
  if (character.background) lines.push(`【背景】出身背景：${character.background}`);
  if (character.keyEvents?.length)
    lines.push(`关键经历：${character.keyEvents.join("；")}`);
  if (character.abilities?.length)
    lines.push(`能力/特殊设定：${character.abilities.join("、")}`);
  if (character.goals) lines.push(`目标/动机：${character.goals}`);

  /* ---- 人际关系 ---- */
  if (character.protagonistRelation)
    lines.push(`【人际关系】与主角关系：${character.protagonistRelation}`);
  if (character.socialTendency)
    lines.push(`社交倾向：${character.socialTendency}`);

  const relations: string[] = [];
  for (const rel of character.relationshipsAsA ?? []) {
    const other = rel.characterB?.name;
    if (other) relations.push(`${rel.relationshipType} ${other}`);
  }
  for (const rel of character.relationshipsAsB ?? []) {
    const other = rel.characterA?.name;
    if (other) relations.push(`${rel.relationshipType} ${other}`);
  }
  if (relations.length) lines.push(`重要关系人：${relations.join("；")}`);

  /* ---- 角色弧线 ---- */
  if (character.initialState) lines.push(`【角色弧线】初始状态：${character.initialState}`);
  if (character.arcDirection) lines.push(`变化方向：${character.arcDirection}`);
  if (character.finalState) lines.push(`最终状态：${character.finalState}`);

  /* ---- 创作备忘 ---- */
  if (character.inspiration) lines.push(`【创作备忘】灵感来源：${character.inspiration}`);
  if (character.authorNotes) lines.push(`作者备注：${character.authorNotes}`);

  /* ---- 自定义字段 ---- */
  if (character.customFields?.length) {
    lines.push("【其他设定】");
    for (const field of character.customFields) {
      if (field.label && field.value) {
        lines.push(`${field.label}：${field.value}`);
      }
    }
  }

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  路由                                                               */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const {
    messages,
    mode,
    novelId,
    chapterId,
    characterName,
    currentScene,
    module,
    provider,
    model,
    customApiKey,
    customBaseURL,
  } = (await req.json()) as {
    messages?: UIMessage[];
    mode?: string;
    novelId?: string | null;
    chapterId?: string | null;
    /** 角色行为：直接指定的角色名（编辑器右键菜单带入） */
    characterName?: string | null;
    /** 卡文建议：额外提供的当前场景文本（可选） */
    currentScene?: string | null;
    /** 功能模块：按模块配置解析（writer_block / character_behavior 等） */
    module?: string | null;
    /** 旧版显式覆盖（一般对话无 module 时兜底） */
    provider?: string | null;
    model?: string | null;
    customApiKey?: string | null;
    customBaseURL?: string | null;
  };
  const chatMessages: UIMessage[] = Array.isArray(messages) ? messages : [];

  /* ---------------- 1. 构建候选模型列表（customKeys → env → 智谱兜底） ---------------- */

  // legacy 模式：custom provider 或 显式指定 customApiKey → 直接用 resolveAiConfig
  const isLegacyCustom = customApiKey?.trim() || provider === "custom";

  let candidates: ModelCandidate[] = [];
  let fallbackResolved: Awaited<ReturnType<typeof resolveAiConfig>> | null = null;

  if (isLegacyCustom) {
    fallbackResolved = await resolveAiConfig({
      module,
      provider,
      model,
      customApiKey,
      customBaseURL,
    });
  } else {
    const normalizedModule: AiModuleKey | null =
      module &&
      (module === "character_extraction" ||
        module === "writer_block" ||
        module === "character_behavior" ||
        module === "storyline_analysis")
        ? (module as AiModuleKey)
        : null;
    candidates = await buildModelCandidates(normalizedModule);
  }

  // legacy custom：直接走原逻辑
  if (fallbackResolved) {
    if (!fallbackResolved.ok) {
      return new Response(fallbackResolved.error, { status: fallbackResolved.status });
    }
    const { apiKey, model: modelName, baseURL } = fallbackResolved.config;
    console.log(
      `[AI Chat] ${module ? `Module '${module}'` : "No module (general)"} → legacy/provider: ${fallbackResolved.config.provider}, model: ${modelName}`,
    );
    const chatMode2: ChatMode =
      mode === "writer_block" || mode === "character_advice" ? mode : "general";
    let instructions2 = GENERAL_SYSTEM;
    if (chatMode2 === "writer_block") {
      const sceneText = await getRecentScenesText(chapterId);
      const extraScene = currentScene?.trim()
        ? `\n\n【用户补充的当前场景】\n${currentScene.trim().slice(0, 5_000)}`
        : "";
      instructions2 = sceneText
        ? `${WRITER_BLOCK_SYSTEM}\n\n【当前章节最近 2 个场景内容】\n${sceneText}${extraScene}`
        : `${WRITER_BLOCK_SYSTEM}\n\n（当前未提供章节场景内容，请基于用户描述给出通用建议。）${extraScene}`;
    } else if (chatMode2 === "character_advice") {
      const lastUser = [...chatMessages].reverse().find((m) => m.role === "user");
      const name = characterName?.trim()
        ? characterName.trim()
        : await resolveCharacterName(
            novelId,
            lastUser ? getUIMessageText(lastUser) : "",
          );
      const profile = await getCharacterProfileText(novelId, name);
      instructions2 = profile
        ? `${CHARACTER_ADVICE_SYSTEM}\n\n【角色档案】\n${profile}`
        : `${CHARACTER_ADVICE_SYSTEM}\n\n（未在档案库中找到「${name}」的角色资料，请基于用户描述尽力分析，并建议其使用「提取角色」功能建立档案。）`;
    }
    const modelInstance2 = getModelInstance(apiKey, baseURL, modelName);
    const result2 = streamText({
      model: modelInstance2,
      instructions: instructions2,
      messages: await convertToModelMessages(chatMessages),
    });
    return createUIMessageStreamResponse({
      stream: toUIMessageStream({ stream: result2.stream }),
    });
  }

  if (candidates.length === 0) {
    return new Response(
      "服务暂不可用：未配置任何可用的 API Key，请在设置页面配置提供商的 API Key。",
      { status: 503 },
    );
  }

  /* ---------------- 2. 按 mode 构建 system 指令（含数据库上下文） ---------------- */
  const chatMode: ChatMode =
    mode === "writer_block" || mode === "character_advice" ? mode : "general";

  let instructions = GENERAL_SYSTEM;

  if (chatMode === "writer_block") {
    const sceneText = await getRecentScenesText(chapterId);
    const extraScene = currentScene?.trim()
      ? `\n\n【用户补充的当前场景】\n${currentScene.trim().slice(0, 5_000)}`
      : "";
    instructions = sceneText
      ? `${WRITER_BLOCK_SYSTEM}\n\n【当前章节最近 2 个场景内容】\n${sceneText}${extraScene}`
      : `${WRITER_BLOCK_SYSTEM}\n\n（当前未提供章节场景内容，请基于用户描述给出通用建议。）${extraScene}`;
  } else if (chatMode === "character_advice") {
    const lastUser = [...chatMessages].reverse().find((m) => m.role === "user");
    // 优先使用请求中直接指定的角色名，否则从最后一条用户消息解析
    const name = characterName?.trim()
      ? characterName.trim()
      : await resolveCharacterName(
          novelId,
          lastUser ? getUIMessageText(lastUser) : "",
        );
    const profile = await getCharacterProfileText(novelId, name);
    instructions = profile
      ? `${CHARACTER_ADVICE_SYSTEM}\n\n【角色档案】\n${profile}`
      : `${CHARACTER_ADVICE_SYSTEM}\n\n（未在档案库中找到「${name}」的角色资料，请基于用户描述尽力分析，并建议其使用「提取角色」功能建立档案。）`;
  }
  const modelMessages = await convertToModelMessages(chatMessages);

  /* ---------------- 3. 逐个 candidate 尝试：先用 generateText 健康检查，再流式返回 ---------------- */

  let chosen: ModelCandidate | null = null;
  let lastMsg = "";

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    try {
      console.log(
        `[AI Chat] 健康检查 ${i + 1}/${candidates.length}: provider=${c.provider}, model=${c.modelName}, keySource=${c.keySource}`,
      );
      // 用一条非常短的消息验证能连通（model 必须能返回 1~2 个 token 即可）
      await Promise.race([
        generateText({
          model: c.model,
          prompt: "请只回复 OK 这两个字母，不要回复其他任何内容。",
          temperature: 0,
          maxOutputTokens: 4,
        }),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("TIMEOUT")), 15_000),
        ),
      ]);
      chosen = c;
      console.log(
        `[AI Chat] 候选 ${i + 1} 健康检查通过，正式使用 ${c.provider}/${c.modelName} (keySource=${c.keySource})`,
      );
      break;
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message === "TIMEOUT"
            ? "超时"
            : e.message
          : String(e);
      lastMsg = msg;
      console.warn(
        `[AI Chat] 候选 ${i + 1}/${candidates.length} 健康检查失败 (${c.provider}/${c.modelName}, keySource=${c.keySource}): ${msg}`,
      );
    }
  }

  if (!chosen) {
    return new Response(
      `对话失败：所有可用 API Key 均无法连通。最后一次错误：${lastMsg || "未知错误"}。请在设置页面检查 API Key 配置。`,
      { status: 502 },
    );
  }

  // 3. 流式生成（选择通过健康检查的候选）
  const result = streamText({
    model: chosen.model,
    instructions,
    messages: modelMessages,
  });

  const response = createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });

  // 在响应头中标记当前使用的模型，供前端展示
  // 注意：HTTP header 只接受 ASCII 字符，中文字符（如"智谱"）会报 TypeError
  const headers = new Headers(response.headers);
  headers.set("X-Model-Provider", chosen.provider);
  headers.set("X-Model-Name", chosen.modelName);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
