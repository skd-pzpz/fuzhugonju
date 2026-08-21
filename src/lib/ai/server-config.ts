/**
 * 服务端 AI 模型配置解析（仅在 server 端使用）。
 * - 按功能模块解析（model_config）+ 各提供商独立 Key（custom_keys，解密）
 * - 平台默认 Key 走环境变量
 * - 返回可直接调用的 OpenAI 兼容模型实例
 */
import { createOpenAI } from "@ai-sdk/openai";

import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { decryptSecret } from "@/lib/ai/crypto";
import {
  AI_PROVIDER_MAP,
  normalizeProviderId,
  type AiProviderId,
} from "@/lib/ai/providers";
import {
  DEFAULT_MODEL_CONFIG,
  isModuleKey,
  parseCustomKeys,
  parseModelConfig,
  type AiModuleKey,
  type CustomKeys,
  type ModelConfig,
} from "@/lib/ai/modules";

/** 取某提供商的平台默认 Key（环境变量），未配置返回 null */
export function getProviderDefaultKey(
  providerId: AiProviderId,
): string | null {
  const provider = AI_PROVIDER_MAP[providerId];
  if (!provider) return null;
  if (provider.envKey && process.env[provider.envKey]) {
    return process.env[provider.envKey]!;
  }
  for (const fallback of provider.fallbackEnvKeys ?? []) {
    if (process.env[fallback]) return process.env[fallback]!;
  }
  return null;
}

/** 创建 OpenAI 兼容模型实例（一律走 Chat Completions，兼容智谱等国内服务） */
export function getModelInstance(
  apiKey: string,
  baseURL: string | undefined,
  model: string,
) {
  return createOpenAI({ apiKey, baseURL }).chat(model);
}

export type AiConfigOverrides = {
  /** 功能模块：按模块配置解析（优先） */
  module?: AiModuleKey | string | null;
  /** 显式覆盖（无 module 时的兜底，兼容旧调用） */
  provider?: string | null;
  model?: string | null;
  /** 自定义提供商：请求级临时 Key/BaseURL（不落库） */
  customApiKey?: string | null;
  customBaseURL?: string | null;
};

export type ResolvedAiConfig = {
  provider: AiProviderId;
  model: string;
  apiKey: string;
  baseURL?: string;
};

type ResolveResult =
  | { ok: true; config: ResolvedAiConfig }
  | { ok: false; status: number; error: string };

/**
 * 按模块名解析 AI 模型配置（推荐使用）。
 * - 必须传入 module 参数，否则抛错
 * - 读取用户设置 → 解析 model_config → 确定 provider/model → 获取 API Key
 * - Key 获取顺序：customKeys（数据库自定义） → 环境变量平台默认 Key → 回退智谱
 * - 返回模型实例 + provider + modelName
 */
export async function getModelForModule(
  module: AiModuleKey | null | undefined,
): Promise<
  | { ok: true; model: ReturnType<typeof getModelInstance>; provider: AiProviderId; modelName: string; keySource: string }
  | { ok: false; error: string }
> {
  if (!module) {
    console.error("[AI Model] ERROR: module 参数不能为空，调用处必须传入模块名");
    return { ok: false, error: "模型配置错误：未指定功能模块" };
  }
  if (!isModuleKey(module)) {
    console.error(`[AI Model] ERROR: 非法模块名 '${module}'`);
    return { ok: false, error: `模型配置错误：非法模块名 '${module}'` };
  }

  console.log(`[AI Model] getModelForModule('${module}')`);

  const settings = await db.query.userSettings.findFirst();
  const modelConfig: ModelConfig = parseModelConfig(settings?.modelConfig);
  const customKeys: CustomKeys = parseCustomKeys(settings?.customKeys);

  const mc = modelConfig[module] ?? DEFAULT_MODEL_CONFIG[module];
  const gd = modelConfig.global_default ?? DEFAULT_MODEL_CONFIG.global_default;
  const useGlobal = mc?.use_global !== false;

  let provider: AiProviderId;
  let modelName: string;

  if (useGlobal) {
    provider = normalizeProviderId(gd.provider);
    modelName = gd.model.trim() || DEFAULT_MODEL_CONFIG.global_default.model;
    console.log(`[AI Model] Resolved: module='${module}', use_global=true, provider=${provider}, model=${modelName} (from global_default)`);
  } else {
    provider = normalizeProviderId(mc?.provider ?? gd.provider);
    modelName = mc?.model?.trim() || gd.model || DEFAULT_MODEL_CONFIG.global_default.model;
    console.log(`[AI Model] Resolved: module='${module}', use_global=false, provider=${provider}, model=${modelName} (independent)`);
  }

  if (provider === "custom") {
    const apiKey = settings?.customApiKey ? decryptSecret(settings.customApiKey) : "";
    const baseURL = settings?.customBaseUrl || "";
    if (!apiKey) return { ok: false, error: "自定义提供商未配置 API Key" };
    if (!baseURL) return { ok: false, error: "自定义提供商未配置 Base URL" };
    console.log(`[AI Model] Created: provider=custom, model=${modelName}, keySource=custom`);
    return { ok: true, model: getModelInstance(apiKey, baseURL, modelName), provider, modelName, keySource: "custom" };
  }

  const providerDef = AI_PROVIDER_MAP[provider];

  // 候选 Key 列表：按优先级依次尝试（第一个成功的即使用）
  // 1. 数据库 customKeys（用户在设置页面自定义的 Key）
  // 2. .env 平台默认 Key（环境变量）
  type KeyCandidate = {
    source: string;
    apiKey: string;
    baseURL: string;
  };
  const candidates: KeyCandidate[] = [];

  const customEntry = customKeys[provider];
  const customKey = customEntry?.apiKey ? decryptSecret(customEntry.apiKey) : "";
  if (customKey) {
    candidates.push({
      source: `customKeys.${provider}`,
      apiKey: customKey,
      baseURL: customEntry?.baseUrl?.trim() || providerDef.baseURL,
    });
  }

  const envKey = getProviderDefaultKey(provider) || "";
  if (envKey && !candidates.some((c) => c.apiKey === envKey)) {
    candidates.push({
      source: `env:${providerDef.envKey ?? provider}`,
      apiKey: envKey,
      baseURL: providerDef.baseURL,
    });
  }

  // 如果目标 provider 不是 zhipu，末尾加智谱作为最终兜底
  if (provider !== "zhipu") {
    const zhipuKey = getProviderDefaultKey("zhipu") || process.env.ZHIPU_API_KEY || "";
    if (zhipuKey && !candidates.some((c) => c.apiKey === zhipuKey)) {
      candidates.push({
        source: "fallback:zhipu",
        apiKey: zhipuKey,
        baseURL: "https://open.bigmodel.cn/api/paas/v4",
      });
    }
  }

  if (candidates.length === 0) {
    return { ok: false, error: `未配置 ${providerDef.label} 的 API Key` };
  }

  const first = candidates[0];
  const label =
    first.source === "fallback:zhipu"
      ? "（回退智谱）"
      : "";
  console.log(
    `[AI Model] Created: provider=${provider === "zhipu" && first.source === "fallback:zhipu" ? "zhipu" : provider}, model=${
      first.source === "fallback:zhipu" ? "glm-4-flash" : modelName
    }, keySource=${first.source}${label}`,
  );

  return {
    ok: true,
    model: getModelInstance(
      first.apiKey,
      first.baseURL,
      first.source === "fallback:zhipu" ? "glm-4-flash" : modelName,
    ),
    provider: first.source === "fallback:zhipu" ? "zhipu" : provider,
    modelName: first.source === "fallback:zhipu" ? "glm-4-flash" : modelName,
    keySource: first.source,
  };
}

/**
 * 解析最终 AI 配置（旧版，保留兼容）。
 * - 传 module：取 model_config[module] 的 provider/model，Key 优先 custom_keys（解密），
 *   否则环境变量默认；custom_keys 未配置且环境变量缺失 → 503「服务暂不可用」
 * - 不传 module（如自由对话）：回退全局 provider/model + legacy custom 字段
 */
export async function resolveAiConfig(
  overrides: AiConfigOverrides = {},
): Promise<ResolveResult> {
  // 用户设置（单用户，取首条）
  const settings = await db.query.userSettings.findFirst();
  const modelConfig: ModelConfig = parseModelConfig(settings?.modelConfig);
  const customKeys: CustomKeys = parseCustomKeys(settings?.customKeys);

  let provider: AiProviderId;
  let model: string;

  const moduleKey: AiModuleKey | null =
    overrides.module && isModuleKey(overrides.module) ? overrides.module : null;

  if (moduleKey) {
    // 模块级解析：use_global=true（或缺省）一律回退 global_default；
    // 独立配置（use_global=false）才使用模块自己的 provider/model
    const mc = modelConfig[moduleKey] ?? DEFAULT_MODEL_CONFIG[moduleKey];
    const gd = modelConfig.global_default ?? DEFAULT_MODEL_CONFIG.global_default;
    const useGlobal = mc?.use_global !== false;
    if (useGlobal) {
      provider = normalizeProviderId(gd.provider);
      model = gd.model.trim() || DEFAULT_MODEL_CONFIG.global_default.model;
      console.log(`[AI Model] Module '${moduleKey}' → use_global=true → provider: ${provider}, model: ${model} (from global_default)`);
    } else {
      provider = normalizeProviderId(
        overrides.provider ?? mc?.provider ?? gd.provider,
      );
      model =
        overrides.model?.trim() ||
        mc?.model?.trim() ||
        gd.model ||
        DEFAULT_MODEL_CONFIG.global_default.model;
      console.log(`[AI Model] Module '${moduleKey}' → use_global=false → provider: ${provider}, model: ${model} (independent)`);
    }
  } else {
    // 全局兜底（自由对话等）：优先使用 model_config.global_default
    const gd = modelConfig.global_default ?? DEFAULT_MODEL_CONFIG.global_default;
    provider = normalizeProviderId(overrides.provider ?? gd.provider ?? settings?.provider ?? "zhipu");
    model = overrides.model?.trim() || gd.model.trim() || settings?.model?.trim() || "glm-4-flash";
    console.log(`[AI Model] No module specified → provider: ${provider}, model: ${model} (from global_default)`);
  }

  const providerDef = AI_PROVIDER_MAP[provider];

  // 自定义提供商（legacy）：任意 OpenAI 兼容端点
  if (provider === "custom") {
    const apiKey =
      overrides.customApiKey?.trim() ||
      (settings?.customApiKey ? decryptSecret(settings.customApiKey) : "");
    const baseURL =
      overrides.customBaseURL?.trim() || settings?.customBaseUrl || "";
    const customModel =
      settings?.customModelName?.trim() || overrides.model?.trim() || model || "";
    if (!apiKey) {
      return { ok: false, status: 400, error: "自定义提供商未配置 API Key，请在设置中填写" };
    }
    if (!baseURL) {
      return { ok: false, status: 400, error: "自定义提供商未配置 Base URL" };
    }
    if (!customModel) {
      return { ok: false, status: 400, error: "自定义提供商未配置模型名称" };
    }
    console.log(`[AI Model] → custom, model: ${customModel}, hasApiKey: ${!!apiKey}`);
    return { ok: true, config: { provider, model: customModel, apiKey, baseURL } };
  }

  // 已知提供商：Key 优先 custom_keys（各提供商独立配置，解密），否则环境变量
  const customEntry = customKeys[provider];
  const customKey = customEntry?.apiKey ? decryptSecret(customEntry.apiKey) : "";
  const apiKey = customKey || getProviderDefaultKey(provider) || "";
  console.log(`[AI Model] → provider: ${provider}, customKey: ${!!customKey}, defaultKey: ${!!getProviderDefaultKey(provider)} → final apiKey: ${!!apiKey}`);
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: `服务暂不可用：未配置 ${providerDef.label} 的 API Key（可设置各提供商 Key 或环境变量）`,
    };
  }
  const baseURL =
    (customEntry?.baseUrl?.trim() || providerDef.baseURL) || undefined;

  return { ok: true, config: { provider, model, apiKey, baseURL } };
}

/* ------------------------------------------------------------------ */
/*  多层候选模型 + Key（供运行时逐个尝试回退）                             */
/* ------------------------------------------------------------------ */

export type ModelCandidate = {
  model: ReturnType<typeof getModelInstance>;
  provider: AiProviderId;
  modelName: string;
  keySource: string;
};

/**
 * 构建候选模型列表（按优先级）：
 *   1. 数据库 customKeys[provider]（用户在设置页面自定义的 Key）
 *   2. .env 平台默认 Key（环境变量）
 *   3. 智谱兜底（当目标 provider 不是 zhipu 时）
 *
 * 相同 apiKey 值会自动去重（避免 customKeys 和 .env 填的是同一个 Key 时重复尝试）。
 *
 * @param module 功能模块，若传 null/undefined 则视为"自由对话"，使用 global_default
 */
export async function buildModelCandidates(
  module: AiModuleKey | null | undefined,
): Promise<ModelCandidate[]> {
  const settings = await db.query.userSettings.findFirst();
  const modelConfig: ModelConfig = parseModelConfig(settings?.modelConfig);
  const customKeys: CustomKeys = parseCustomKeys(settings?.customKeys);

  let provider: AiProviderId;
  let modelName: string;

  if (module && isModuleKey(module)) {
    const mc = modelConfig[module] ?? DEFAULT_MODEL_CONFIG[module];
    const gd = modelConfig.global_default ?? DEFAULT_MODEL_CONFIG.global_default;
    const useGlobal = mc?.use_global !== false;
    if (useGlobal) {
      provider = normalizeProviderId(gd.provider);
      modelName = gd.model.trim() || DEFAULT_MODEL_CONFIG.global_default.model;
    } else {
      provider = normalizeProviderId(mc?.provider ?? gd.provider);
      modelName = mc?.model?.trim() || gd.model || DEFAULT_MODEL_CONFIG.global_default.model;
    }
  } else {
    // 无模块（自由对话等）：走 global_default
    const gd = modelConfig.global_default ?? DEFAULT_MODEL_CONFIG.global_default;
    provider = normalizeProviderId(gd.provider);
    modelName = gd.model.trim() || DEFAULT_MODEL_CONFIG.global_default.model;
  }

  const candidates: ModelCandidate[] = [];
  const seenKeys = new Set<string>();
  const providerDef = AI_PROVIDER_MAP[provider];

  const tryAdd = (
    src: string,
    key: string,
    base: string,
    prov: AiProviderId,
    m: string,
  ) => {
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);
    candidates.push({
      model: getModelInstance(key, base, m),
      provider: prov,
      modelName: m,
      keySource: src,
    });
  };

  // custom provider：不参与候选构建（留给 resolveAiConfig 的 legacy 分支）
  if (provider === "custom") return candidates;

  // 1) customKeys[provider]
  const cEntry = customKeys[provider];
  const cKey = cEntry?.apiKey ? decryptSecret(cEntry.apiKey) : "";
  if (cKey) {
    tryAdd(
      `customKeys.${provider}`,
      cKey,
      cEntry?.baseUrl?.trim() || providerDef.baseURL,
      provider,
      modelName,
    );
  }

  // 2) env 平台默认 Key
  const envK = getProviderDefaultKey(provider) || "";
  if (envK) {
    tryAdd(
      `env:${providerDef.envKey ?? provider}`,
      envK,
      providerDef.baseURL,
      provider,
      modelName,
    );
  }

  // 3) 智谱兜底（当目标 provider 不是 zhipu）
  if (provider !== "zhipu") {
    const zhipuCustom = customKeys["zhipu"];
    const zhipuKey =
      (zhipuCustom?.apiKey ? decryptSecret(zhipuCustom.apiKey) : "") ||
      getProviderDefaultKey("zhipu") ||
      process.env.ZHIPU_API_KEY ||
      "";
    if (zhipuKey) {
      tryAdd(
        "fallback:zhipu",
        zhipuKey,
        "https://open.bigmodel.cn/api/paas/v4",
        "zhipu",
        "glm-4-flash",
      );
    }
  }

  return candidates;
}
