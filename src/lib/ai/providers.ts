/**
 * AI 模型提供商定义（纯数据，无副作用，可被客户端安全导入）。
 * 全部使用 OpenAI 兼容接口（/chat/completions）。
 */

export type AiProviderId =
  | "zhipu"
  | "qwen"
  | "deepseek"
  | "moonshot"
  | "doubao"
  | "lingyi"
  | "minimax"
  | "custom";

export type AiModelOption = {
  id: string;
  label: string;
  /** 模型定位/价格档位等提示 */
  note?: string;
  /** 模型特点标签，如 "免费"、"推理"、"长文本"、"轻量" */
  tags?: string[];
  /** 分组名称，用于下拉框分组显示 */
  group?: "轻量免费" | "平衡" | "高质量" | "推理/长文本";
};

export type AiProvider = {
  id: AiProviderId;
  label: string;
  /** OpenAI 兼容 baseURL */
  baseURL: string;
  /** 未显式选择模型时的默认模型 */
  defaultModel: string;
  models: AiModelOption[];
  /** 平台默认 Key 的环境变量名（仅服务端使用） */
  envKey?: string;
  /** 兼容旧配置的兜底环境变量 */
  fallbackEnvKeys?: string[];
  description?: string;
};

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "zhipu",
    label: "智谱AI",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-4-flash",
    envKey: "ZHIPU_API_KEY",
    fallbackEnvKeys: ["OPENAI_API_KEY"],
    description: "智谱清言 · GLM 系列",
    models: [
      { id: "glm-4-flash", label: "GLM-4-Flash", note: "免费", tags: ["免费", "轻量"], group: "轻量免费" },
      { id: "glm-4-air", label: "GLM-4-Air", note: "平衡", tags: ["平衡"], group: "平衡" },
      { id: "glm-4-airx", label: "GLM-4-AirX", note: "平衡", tags: ["平衡"], group: "平衡" },
      { id: "glm-4-plus", label: "GLM-4-Plus", note: "付费·更强", tags: ["高质量"], group: "高质量" },
      { id: "glm-4-long", label: "GLM-4-Long", note: "长文本", tags: ["长文本"], group: "推理/长文本" },
    ],
  },
  {
    id: "qwen",
    label: "阿里云通义千问",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-turbo",
    envKey: "DASHSCOPE_API_KEY",
    description: "通义千问 Qwen 系列",
    models: [
      { id: "qwen-turbo", label: "Qwen-Turbo", note: "轻量快", tags: ["轻量", "便宜"], group: "轻量免费" },
      { id: "qwen-plus", label: "Qwen-Plus", note: "平衡", tags: ["平衡"], group: "平衡" },
      { id: "qwen-max", label: "Qwen-Max", note: "最强", tags: ["高质量"], group: "高质量" },
      { id: "qwen-coder-plus", label: "Qwen-Coder-Plus", note: "代码", tags: ["结构化"], group: "高质量" },
      { id: "qwen-long", label: "Qwen-Long", note: "长文本", tags: ["长文本"], group: "推理/长文本" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
    description: "深度求索",
    models: [
      { id: "deepseek-chat", label: "DeepSeek-Chat", note: "V3", tags: ["高质量"], group: "高质量" },
      { id: "deepseek-reasoner", label: "DeepSeek-Reasoner", note: "R1·推理", tags: ["推理"], group: "推理/长文本" },
    ],
  },
  {
    id: "moonshot",
    label: "月之暗面",
    baseURL: "https://api.moonshot.cn/v1",
    defaultModel: "moonshot-v1-8k",
    envKey: "MOONSHOT_API_KEY",
    description: "Kimi",
    models: [
      { id: "moonshot-v1-8k", label: "Moonshot-v1-8k", note: "8k", tags: [], group: "平衡" },
      { id: "moonshot-v1-32k", label: "Moonshot-v1-32k", note: "32k", tags: [], group: "高质量" },
      { id: "moonshot-v1-128k", label: "Moonshot-v1-128k", note: "128k·长文本", tags: ["长文本"], group: "推理/长文本" },
    ],
  },
  {
    id: "doubao",
    label: "字节豆包",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: "doubao-lite-4k",
    envKey: "ARK_API_KEY",
    description: "火山引擎方舟",
    models: [
      { id: "doubao-lite-4k", label: "Doubao-Lite-4k", note: "轻量", tags: ["轻量"], group: "轻量免费" },
      { id: "doubao-lite-32k", label: "Doubao-Lite-32k", note: "轻量", tags: ["轻量"], group: "平衡" },
      { id: "doubao-pro-4k", label: "Doubao-Pro-4k", note: "平衡", tags: ["平衡"], group: "平衡" },
      { id: "doubao-pro-128k", label: "Doubao-Pro-128k", note: "长文本", tags: ["长文本"], group: "推理/长文本" },
      { id: "doubao-vision-pro", label: "Doubao-Vision-Pro", note: "多模态", tags: ["多模态"], group: "高质量" },
    ],
  },
  {
    id: "lingyi",
    label: "零一万物",
    baseURL: "https://api.lingyiwanwu.com/v1",
    defaultModel: "yi-lightning",
    envKey: "LINGYI_API_KEY",
    description: "零一万物 Yi 系列",
    models: [
      { id: "yi-lightning", label: "Yi-Lightning", note: "闪电", tags: ["轻量"], group: "轻量免费" },
      { id: "yi-medium", label: "Yi-Medium", note: "平衡", tags: ["平衡"], group: "平衡" },
      { id: "yi-large", label: "Yi-Large", note: "最强", tags: ["高质量"], group: "高质量" },
      { id: "yi-spark", label: "Yi-Spark", note: "轻量快", tags: ["轻量"], group: "轻量免费" },
    ],
  },
  {
    id: "minimax",
    label: "MiniMax",
    baseURL: "https://api.minimax.chat/v1",
    defaultModel: "abab6.5s",
    envKey: "MINIMAX_API_KEY",
    description: "MiniMax 海螺 AI",
    models: [
      { id: "abab6.5s", label: "abab6.5s", note: "轻量", tags: ["轻量"], group: "轻量免费" },
      { id: "abab6.5t", label: "abab6.5t", note: "平衡", tags: ["平衡"], group: "平衡" },
      { id: "abab6.5g", label: "abab6.5g", note: "高质量", tags: ["高质量"], group: "高质量" },
    ],
  },
  {
    id: "custom",
    label: "自定义",
    baseURL: "",
    defaultModel: "",
    description: "任意 OpenAI 兼容接口",
    models: [],
  },
];

export const AI_PROVIDER_MAP: Record<AiProviderId, AiProvider> =
  Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p])) as Record<
    AiProviderId,
    AiProvider
  >;

/** 判断 id 是否为合法提供商 */
export function isProviderId(id: string | null | undefined): id is AiProviderId {
  return !!id && id in AI_PROVIDER_MAP;
}

/** 规范化提供商 id（非法值回退默认 zhipu） */
export function normalizeProviderId(id: string | null | undefined): AiProviderId {
  return isProviderId(id) ? id : "zhipu";
}