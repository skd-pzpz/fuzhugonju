"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { encryptSecret, isEncryptionEnabled } from "@/lib/ai/crypto";
import {
  AI_MODULE_LIST,
  DEFAULT_CUSTOM_KEYS,
  DEFAULT_MODEL_CONFIG,
  isModuleKey,
  parseCustomKeys,
  parseModelConfig,
  type AiModuleKey,
  type GlobalModelConfig,
  type ModuleModelConfig,
} from "@/lib/ai/modules";
import { AI_PROVIDERS, isProviderId, normalizeProviderId } from "@/lib/ai/providers";
import { getProviderDefaultKey } from "@/lib/ai/server-config";

export type GlobalConfigDto = { provider: string; model: string };
export type ModuleConfigDto = {
  provider: string;
  model: string;
  use_global: boolean;
};
export type ProviderKeyDto = { hasKey: boolean; baseUrl: string };

export type AiConfigDto = {
  /** 全局默认模型配置 */
  globalDefault: GlobalConfigDto;
  /** 各功能模块的 provider + model + 是否继承全局默认 */
  modelConfig: Record<AiModuleKey, ModuleConfigDto>;
  /** 各提供商独立 Key 状态（值不回传，仅布尔 + baseUrl） */
  providerKeys: Record<string, ProviderKeyDto>;
  /** 各平台环境变量默认 Key 是否已配置（仅布尔） */
  platformKeys: Record<string, boolean>;
};

/** 读取当前 AI 模型配置（服务端调用，绝不回传任何 Key） */
export async function getAiConfig(): Promise<AiConfigDto> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const userId = session.user.id;

  const row = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  const modelConfig = parseModelConfig(row?.modelConfig);
  const customKeys = parseCustomKeys(row?.customKeys);

  const globalDefault: GlobalConfigDto = {
    provider: modelConfig.global_default.provider,
    model: modelConfig.global_default.model,
  };

  const configDto = {} as Record<AiModuleKey, ModuleConfigDto>;
  for (const module of AI_MODULE_LIST) {
    const mc: ModuleModelConfig = modelConfig[module.key];
    configDto[module.key] = {
      provider: mc.provider,
      model: mc.model,
      use_global: mc.use_global,
    };
  }

  const providerKeys: Record<string, ProviderKeyDto> = {};
  for (const provider of AI_PROVIDERS) {
    if (provider.id === "custom") continue;
    providerKeys[provider.id] = {
      hasKey: Boolean(customKeys[provider.id]?.apiKey),
      baseUrl: customKeys[provider.id]?.baseUrl ?? "",
    };
  }

  const platformKeys: Record<string, boolean> = {};
  for (const provider of AI_PROVIDERS) {
    if (provider.envKey || provider.fallbackEnvKeys?.length) {
      platformKeys[provider.id] = getProviderDefaultKey(provider.id) !== null;
    }
  }

  return {
    globalDefault,
    modelConfig: configDto,
    providerKeys,
    platformKeys,
  };
}

const globalConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
});

const moduleConfigSchema = z.record(
  z.enum(["character_extraction", "writer_block", "character_behavior", "storyline_analysis"]),
  z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    use_global: z.boolean(),
  }),
);

const providerKeySchema = z.record(
  z.string(),
  z.object({
    /** 传空字符串表示不修改已有 Key */
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
  }),
);

const saveConfigSchema = z.object({
  globalDefault: globalConfigSchema,
  modelConfig: moduleConfigSchema,
  providerKeys: providerKeySchema,
});

export type SaveAiConfigInput = z.infer<typeof saveConfigSchema>;

/** 保存 AI 模型配置（各提供商 Key 加密后落库） */
export async function saveAiConfig(input: SaveAiConfigInput) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  const userId = session.user.id;

  const parsed = saveConfigSchema.parse(input);

  // 校验提供商合法
  if (!isProviderId(parsed.globalDefault.provider)) {
    return { ok: false as const, error: "全局默认配置包含无效的提供商" };
  }
  for (const [moduleKey, mc] of Object.entries(parsed.modelConfig)) {
    if (!isModuleKey(moduleKey)) {
      return { ok: false as const, error: "模型配置包含无效的模块" };
    }
    if (!mc.use_global && !isProviderId(mc.provider)) {
      return { ok: false as const, error: "模型配置包含无效的提供商" };
    }
  }

  const existing = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  const existingKeys = parseCustomKeys(existing?.customKeys);

  // 合并模型配置（补默认值）：
  // - global_default 始终保存
  // - use_global=true 的模块不保存自己的值，统一对齐 global_default
  // - use_global=false 保存用户选择的 provider/model
  const modelConfig = { ...structuredClone(DEFAULT_MODEL_CONFIG) };
  modelConfig.global_default = {
    provider: parsed.globalDefault.provider as GlobalModelConfig["provider"],
    model: parsed.globalDefault.model.trim(),
  };
  for (const module of AI_MODULE_LIST) {
    const submitted = parsed.modelConfig[module.key];
    if (!submitted) continue;
    if (submitted.use_global) {
      modelConfig[module.key] = {
        provider: modelConfig.global_default.provider,
        model: modelConfig.global_default.model,
        use_global: true,
      };
    } else {
      modelConfig[module.key] = {
        provider: normalizeProviderId(submitted.provider),
        model: submitted.model.trim() || modelConfig.global_default.model,
        use_global: false,
      };
    }
  }

  // 各提供商 Key：apiKey 非空才更新（加密），否则保留已有值；baseUrl 同理由传入值或默认值兜底
  const customKeys = { ...structuredClone(DEFAULT_CUSTOM_KEYS) };
  for (const [providerId, entry] of Object.entries(parsed.providerKeys)) {
    if (!(providerId in DEFAULT_CUSTOM_KEYS)) continue;
    const key = providerId as keyof typeof DEFAULT_CUSTOM_KEYS;
    const submittedApiKey = entry.apiKey?.trim() ?? "";
    customKeys[key] = {
      apiKey: submittedApiKey
        ? encryptSecret(submittedApiKey)
        : existingKeys[key]?.apiKey ?? "",
      baseUrl:
        entry.baseUrl?.trim() ||
        existingKeys[key]?.baseUrl ||
        DEFAULT_CUSTOM_KEYS[key]?.baseUrl,
    };
  }

  const values = {
    modelConfig,
    customKeys,
  };

  if (existing) {
    await db
      .update(userSettings)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(userSettings.id, existing.id));
  } else {
    await db.insert(userSettings).values({
      ...values,
      userId,
    });
  }

  return {
    ok: true as const,
    encrypted: isEncryptionEnabled(),
  };
}