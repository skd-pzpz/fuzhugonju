/**
 * AI 功能模块定义：每个功能模块独立配置提供商 + 模型。
 * 纯数据 + 防御性解析，可被客户端安全导入。
 *
 * 结构说明：
 * - global_default：全局默认模型（所有模块默认继承）
 * - 各模块：use_global=true 时忽略本模块的 provider/model，统一走 global_default
 */
import { isProviderId, type AiProviderId } from "./providers";

/** 功能模块 key */
export type AiModuleKey =
  | "character_extraction" // 角色提取（分析本章）
  | "writer_block" // 卡文建议
  | "character_behavior" // 角色行为
  | "storyline_analysis"; // 故事线分析

/** 全局默认模型配置 */
export type GlobalModelConfig = {
  provider: AiProviderId;
  model: string;
};

/** 模块级模型配置：provider + model + 是否继承全局默认 */
export type ModuleModelConfig = {
  provider: AiProviderId;
  model: string;
  /** true：使用 global_default（忽略本模块的 provider/model） */
  use_global: boolean;
};

export type ModelConfig = {
  global_default: GlobalModelConfig;
} & Record<AiModuleKey, ModuleModelConfig>;

/** 每个提供商的独立 Key 配置（apiKey 落库时 AES 加密） */
export type CustomKeyEntry = {
  apiKey: string;
  baseUrl?: string;
};

/** 已知提供商（不含自定义）可独立配置 Key */
export type CustomKeys = Partial<Record<Exclude<AiProviderId, "custom">, CustomKeyEntry>>;

export const AI_MODULE_LIST: {
  key: AiModuleKey;
  label: string;
  description: string;
  /** 模块卡片底部的使用建议 */
  tip: string;
}[] = [
  {
    key: "character_extraction",
    label: "角色提取",
    description: "「分析本章」提取角色与事件",
    tip: "建议：轻量免费模型即可（GLM-4-Flash）",
  },
  {
    key: "writer_block",
    label: "卡文建议",
    description: "写作卡壳时的续写/思路建议",
    tip: "建议：推理模型效果更好（如 DeepSeek-R1）",
  },
  {
    key: "character_behavior",
    label: "角色行为",
    description: "角色行为、反应与心理分析",
    tip: "建议：中高质量模型（如 GLM-4-Plus）",
  },
  {
    key: "storyline_analysis",
    label: "故事线分析",
    description: "情节走向与故事线整理",
    tip: "建议：长文本分析可用 Kimi 128k / Doubao 128k",
  },
];

export const AI_MODULE_MAP: Record<AiModuleKey, (typeof AI_MODULE_LIST)[number]> =
  Object.fromEntries(AI_MODULE_LIST.map((m) => [m.key, m])) as Record<
    AiModuleKey,
    (typeof AI_MODULE_LIST)[number]
  >;

/** 全局默认模型（智谱免费 API） */
export const GLOBAL_DEFAULT_MODEL: GlobalModelConfig = {
  provider: "zhipu",
  model: "glm-4-flash",
};

/** 默认模型配置（与 DB 迁移 default 一致）：全部继承全局默认 = 智谱 glm-4-flash */
export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  global_default: { ...GLOBAL_DEFAULT_MODEL },
  character_extraction: { ...GLOBAL_DEFAULT_MODEL, use_global: true },
  writer_block: { ...GLOBAL_DEFAULT_MODEL, use_global: true },
  character_behavior: { ...GLOBAL_DEFAULT_MODEL, use_global: true },
  storyline_analysis: { ...GLOBAL_DEFAULT_MODEL, use_global: true },
};

/** 默认各提供商 Key 配置（baseUrl 与 providers.ts 一致，无尾斜杠） */
export const DEFAULT_CUSTOM_KEYS: CustomKeys = {
  zhipu: { apiKey: "", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  deepseek: { apiKey: "", baseUrl: "https://api.deepseek.com/v1" },
  qwen: { apiKey: "", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  moonshot: { apiKey: "", baseUrl: "https://api.moonshot.cn/v1" },
  doubao: { apiKey: "", baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
  lingyi: { apiKey: "", baseUrl: "https://api.lingyiwanwu.com/v1" },
  minimax: { apiKey: "", baseUrl: "https://api.minimax.chat/v1" },
};

export function isModuleKey(v: string | null | undefined): v is AiModuleKey {
  return !!v && v in AI_MODULE_MAP;
}

/**
 * 防御性解析 DB 中的 model_config：
 * - 兼容旧结构（无 global_default / 无 use_global 的模块），旧数据一律视为 use_global: true
 * - 独立配置模块（use_global=false）保留自己的 provider/model
 */
export function parseModelConfig(raw: unknown): ModelConfig {
  const base: ModelConfig = structuredClone(DEFAULT_MODEL_CONFIG);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;

  // 全局默认
  const gd = obj.global_default;
  if (gd && typeof gd === "object") {
    const g = gd as Partial<GlobalModelConfig>;
    if (isProviderId(g.provider)) base.global_default.provider = g.provider;
    if (typeof g.model === "string" && g.model.trim()) {
      base.global_default.model = g.model.trim();
    }
  }

  // 各模块
  for (const key of AI_MODULE_LIST.map((m) => m.key)) {
    const entry = obj[key];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Partial<ModuleModelConfig>;
    const useGlobal = typeof e.use_global === "boolean" ? e.use_global : true;
    base[key].use_global = useGlobal;
    if (!useGlobal) {
      // 独立配置：保留模块自己的 provider/model（缺省回退全局默认）
      base[key].provider = isProviderId(e.provider)
        ? e.provider
        : base.global_default.provider;
      base[key].model =
        typeof e.model === "string" && e.model.trim()
          ? e.model.trim()
          : base.global_default.model;
    }
  }
  return base;
}

/** 防御性解析 DB 中的 custom_keys（补默认 baseUrl，Key 保留密文原样） */
export function parseCustomKeys(raw: unknown): CustomKeys {
  const result: CustomKeys = {};
  for (const [providerId, def] of Object.entries(DEFAULT_CUSTOM_KEYS)) {
    result[providerId as keyof CustomKeys] = { ...def };
  }
  if (!raw || typeof raw !== "object") return result;
  const obj = raw as Record<string, Partial<CustomKeyEntry>>;
  for (const [providerId, entry] of Object.entries(obj)) {
    if (!(providerId in DEFAULT_CUSTOM_KEYS)) continue;
    if (!entry || typeof entry !== "object") continue;
    result[providerId as keyof CustomKeys] = {
      apiKey: typeof entry.apiKey === "string" ? entry.apiKey : "",
      baseUrl:
        typeof entry.baseUrl === "string" && entry.baseUrl.trim()
          ? entry.baseUrl.trim()
          : DEFAULT_CUSTOM_KEYS[providerId as keyof CustomKeys]?.baseUrl,
    };
  }
  return result;
}
