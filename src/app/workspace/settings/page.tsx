"use client";

import {
  ChevronDown,
  KeyRound,
  Palette,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  getAiConfig,
  saveAiConfig,
  type AiConfigDto,
} from "@/app/actions/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AI_MODULE_LIST,
  DEFAULT_CUSTOM_KEYS,
  DEFAULT_MODEL_CONFIG,
  type AiModuleKey,
} from "@/lib/ai/modules";
import {
  AI_PROVIDER_MAP,
  AI_PROVIDERS,
  type AiProviderId,
} from "@/lib/ai/providers";
import { applyCustomColorOnly, useTheme, type ThemeName } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";

/** 模块/全局默认中可选的提供商（不含自定义） */
const MODULE_PROVIDERS = AI_PROVIDERS.filter((p) => p.id !== "custom");

type GlobalForm = { provider: AiProviderId; model: string };
type ModuleForm = { provider: AiProviderId; model: string; use_global: boolean };
type ProviderKeyForm = { apiKey: string; baseUrl: string };

/**
 * 提供商 + 模型 联动选择器（全局默认与各模块卡片共用）。
 * disabled 时禁用（继承全局默认的模块不可编辑）。
 */
function ProviderModelSelects({
  provider,
  model,
  onProviderChange,
  onModelChange,
  disabled,
}: {
  provider: AiProviderId;
  model: string;
  onProviderChange: (p: AiProviderId) => void;
  onModelChange: (m: string) => void;
  disabled?: boolean;
}) {
  const providerDef = AI_PROVIDER_MAP[provider];

  // 按 group 分组模型
  const groupedModels: Record<string, typeof providerDef.models> = {};
  const groupOrder = ["轻量免费", "平衡", "高质量", "推理/长文本"];
  for (const m of providerDef.models) {
    const g = m.group ?? "其他";
    if (!groupedModels[g]) groupedModels[g] = [];
    groupedModels[g].push(m);
  }

  return (
    <>
      <Select
        value={provider}
        onValueChange={(v) => v && onProviderChange(v as AiProviderId)}
        disabled={disabled}
      >
        <SelectTrigger aria-label="提供商" className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MODULE_PROVIDERS.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={model}
        onValueChange={(v) => v && onModelChange(v)}
        disabled={disabled}
      >
        <SelectTrigger aria-label="模型" className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groupOrder.map((groupName) => {
            const models = groupedModels[groupName];
            if (!models || models.length === 0) return null;
            return (
              <SelectGroup key={groupName}>
                <SelectLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  {groupName}
                </SelectLabel>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="flex items-center gap-1.5">
                      {m.label}
                      {m.tags?.map((tag) => (
                        <Badge
                          key={tag}
                          variant={
                            tag === "免费" || tag === "轻量"
                              ? "secondary"
                              : tag === "推理" || tag === "长文本"
                                ? "outline"
                                : "outline"
                          }
                          className="px-1 py-0 text-[10px] font-normal"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
          {/* 无 group 的模型 */}
          {groupedModels["其他"]?.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex items-center gap-1.5">
                {m.label}
                {m.tags?.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="px-1 py-0 text-[10px] font-normal"
                  >
                    {tag}
                  </Badge>
                ))}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

export default function SettingsPage() {
  const addToast = useToastStore((s) => s.addToast);
  const { theme: currentTheme, setTheme, customColor, setCustomColor } = useTheme();

  // 拖拽中：直接操作 DOM，不触发 React 状态更新（零重渲染）
  // 松手/失焦时：onBlur 触发 → 提交到全局状态

  /** 全局默认模型配置 */
  const [globalDefault, setGlobalDefault] = useState<GlobalForm>(() => ({
    ...DEFAULT_MODEL_CONFIG.global_default,
  }));
  /** 各模块配置（含是否继承全局默认） */
  const [modules, setModules] = useState<Record<AiModuleKey, ModuleForm>>(() => {
    const base = {} as Record<AiModuleKey, ModuleForm>;
    for (const m of AI_MODULE_LIST) base[m.key] = { ...DEFAULT_MODEL_CONFIG[m.key] };
    return base;
  });
  /** 各提供商 Key 表单值 */
  const [providerKeys, setProviderKeys] = useState<
    Record<string, ProviderKeyForm>
  >(() => {
    const base: Record<string, ProviderKeyForm> = {};
    for (const [id, def] of Object.entries(DEFAULT_CUSTOM_KEYS)) {
      base[id] = { apiKey: "", baseUrl: def.baseUrl ?? "" };
    }
    return base;
  });
  /** 各提供商是否已保存 Key（不回传值，仅用于占位提示） */
  const [hasKeys, setHasKeys] = useState<Record<string, boolean>>({});
  /** 各平台环境变量默认 Key 状态 */
  const [platformKeys, setPlatformKeys] = useState<Record<string, boolean>>({});
  /** API Key 折叠面板是否展开（默认收起） */
  const [keysOpen, setKeysOpen] = useState(false);
  /** 当前展开的提供商 Key 行 */
  const [openProvider, setOpenProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 载入当前配置
  useEffect(() => {
    let cancelled = false;
    void getAiConfig()
      .then((cfg: AiConfigDto) => {
        if (cancelled) return;
        setGlobalDefault({
          provider: cfg.globalDefault.provider as AiProviderId,
          model: cfg.globalDefault.model,
        });
        const next = {} as Record<AiModuleKey, ModuleForm>;
        for (const m of AI_MODULE_LIST) {
          const mc = cfg.modelConfig[m.key] ?? DEFAULT_MODEL_CONFIG[m.key];
          next[m.key] = {
            provider: mc.provider as AiProviderId,
            model: mc.model,
            use_global: mc.use_global,
          };
        }
        setModules(next);
        setProviderKeys((prev) => {
          const merged = { ...prev };
          for (const [id, info] of Object.entries(cfg.providerKeys)) {
            merged[id] = {
              apiKey: "",
              baseUrl: info.baseUrl || merged[id]?.baseUrl || "",
            };
          }
          return merged;
        });
        setHasKeys(
          Object.fromEntries(
            Object.entries(cfg.providerKeys).map(([id, info]) => [id, info.hasKey]),
          ),
        );
        setPlatformKeys(cfg.platformKeys);
      })
      .catch(() => addToast("读取配置失败", "error"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  /* ------------------------- 全局默认 ------------------------- */

  const handleGlobalProviderChange = (p: AiProviderId) => {
    setGlobalDefault({ provider: p, model: AI_PROVIDER_MAP[p].defaultModel });
  };

  const handleGlobalModelChange = (m: string) => {
    setGlobalDefault((prev) => ({ ...prev, model: m }));
  };

  /* ------------------------- 各模块 ------------------------- */

  const handleToggleModuleGlobal = (key: AiModuleKey, useGlobal: boolean) => {
    setModules((prev) => ({ ...prev, [key]: { ...prev[key], use_global: useGlobal } }));
  };

  const handleModuleProviderChange = (key: AiModuleKey, p: AiProviderId) => {
    setModules((prev) => ({
      ...prev,
      [key]: { ...prev[key], provider: p, model: AI_PROVIDER_MAP[p].defaultModel },
    }));
  };

  const handleModuleModelChange = (key: AiModuleKey, m: string) => {
    setModules((prev) => ({ ...prev, [key]: { ...prev[key], model: m } }));
  };

  /** 一键恢复默认：所有模块回到智谱免费模型（继承全局） */
  const handleRestoreDefaults = () => {
    setGlobalDefault({ ...DEFAULT_MODEL_CONFIG.global_default });
    setModules((prev) => {
      const next = { ...prev };
      for (const m of AI_MODULE_LIST) next[m.key] = { ...DEFAULT_MODEL_CONFIG[m.key] };
      return next;
    });
    addToast("已恢复默认配置（所有模块使用智谱免费模型），点击保存生效");
  };

  /* ------------------------- 保存 ------------------------- */

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const modelConfigPayload = {} as Record<
        AiModuleKey,
        { provider: string; model: string; use_global: boolean }
      >;
      for (const m of AI_MODULE_LIST) {
        const mod = modules[m.key];
        modelConfigPayload[m.key] = mod.use_global
          ? // 继承全局：不保存模块自己的值，统一对齐 global_default
            { provider: globalDefault.provider, model: globalDefault.model, use_global: true }
          : { provider: mod.provider, model: mod.model, use_global: false };
      }
      const result = await saveAiConfig({
        globalDefault,
        modelConfig: modelConfigPayload,
        providerKeys,
      });
      if (result.ok) {
        const independentCount = AI_MODULE_LIST.filter(
          (m) => !modules[m.key].use_global,
        ).length;
        const isZhipuFree =
          globalDefault.provider === "zhipu" && globalDefault.model === "glm-4-flash";
        if (independentCount === 0) {
          addToast(
            isZhipuFree
              ? "已保存，所有模块使用智谱免费模型"
              : "已保存，所有模块使用全局默认配置",
          );
        } else {
          addToast(`已保存，${independentCount} 个模块使用独立配置`);
        }
      } else {
        addToast(`保存失败：${result.error}`, "error");
      }
    } catch {
      addToast("保存失败，请重试", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------- Key 表单 ------------------------- */

  const THEME_PRESETS = [
    { id: 'default' as ThemeName, name: '科技紫', color: 'bg-[rgb(99,102,241)]' },
    { id: 'amber' as ThemeName, name: '作家琥珀', color: 'bg-[rgb(217,119,6)]' },
    { id: 'forest' as ThemeName, name: '墨绿藏书', color: 'bg-[rgb(5,150,105)]' },
    { id: 'slate' as ThemeName, name: '石墨靛青', color: 'bg-[rgb(8,145,178)]' },
    { id: 'sakura' as ThemeName, name: '樱花物语', color: 'bg-[rgb(219,39,119)]' },
    { id: 'ocean' as ThemeName, name: '午夜深海', color: 'bg-[rgb(14,165,233)]' },
  ];

  const handleKeyChange = (providerId: string, value: string) => {
    setProviderKeys((prev) => ({
      ...prev,
      [providerId]: { ...prev[providerId], apiKey: value },
    }));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-primary" />
            AI 模型配置
          </CardTitle>
          <CardDescription className="text-xs">
            所有功能模块默认使用「全局默认」模型（智谱免费 API）；可关闭某模块的「使用全局默认」进行独立配置。
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-28 animate-pulse rounded-xl bg-muted" />
                <div className="h-28 animate-pulse rounded-xl bg-muted" />
              </div>
            </div>
          ) : (
            <>
              {/* 全局默认卡片 */}
              <div className="rounded-xl border-2 border-primary/60 bg-primary/[0.05] p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <h3 className="text-sm font-semibold">全局默认</h3>
                  <Badge
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px] font-normal"
                  >
                    所有模块默认使用此配置
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ProviderModelSelects
                    provider={globalDefault.provider}
                    model={globalDefault.model}
                    onProviderChange={handleGlobalProviderChange}
                    onModelChange={handleGlobalModelChange}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  💡 切换后所有「使用全局默认」的模块同步生效；独立配置的模块不受影响。
                </p>
              </div>

              {/* 各模块独立配置（2 列网格） */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">各模块独立配置</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestoreDefaults}
                    className="gap-1.5"
                  >
                    <RotateCcw className="size-3.5" />
                    一键恢复默认
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {AI_MODULE_LIST.map((module) => {
                    const mc = modules[module.key];
                    const useGlobal = mc.use_global;
                    // 继承全局默认的模块：显示全局值（不可编辑）
                    const provider = useGlobal ? globalDefault.provider : mc.provider;
                    const model = useGlobal ? globalDefault.model : mc.model;
                    return (
                      <div
                        key={module.key}
                        className={cn(
                          "rounded-xl border p-3.5 transition-opacity",
                          useGlobal
                            ? "border-border/50 opacity-75"
                            : "border-border/80",
                        )}
                      >
                        <div className="mb-2.5 flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">{module.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {module.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">
                              使用全局默认
                            </span>
                            <Switch
                              size="sm"
                              checked={mc.use_global}
                              onCheckedChange={(v) =>
                                handleToggleModuleGlobal(module.key, v)
                              }
                              aria-label={`${module.label}使用全局默认`}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <ProviderModelSelects
                            provider={provider}
                            model={model}
                            onProviderChange={(p) =>
                              handleModuleProviderChange(module.key, p)
                            }
                            onModelChange={(m) =>
                              handleModuleModelChange(module.key, m)
                            }
                            disabled={useGlobal}
                          />
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          💡 {module.tip}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border/60" />

              {/* 各提供商 API Key（折叠面板，默认收起） */}
              <Collapsible open={keysOpen} onOpenChange={setKeysOpen}>
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 px-4 py-3 text-sm font-medium hover:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <KeyRound className="size-4 text-muted-foreground" />
                    各提供商 API Key
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground transition-transform",
                      keysOpen && "rotate-180",
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {Object.entries(providerKeys).map(([providerId, form]) => {
                    const providerDef = AI_PROVIDER_MAP[providerId as AiProviderId];
                    const platformReady = platformKeys[providerId];
                    const hasKey = hasKeys[providerId];
                    const isOpen = openProvider === providerId;
                    return (
                      <div
                        key={providerId}
                        className="overflow-hidden rounded-xl border border-border/60"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenProvider(isOpen ? null : providerId)
                          }
                          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-muted/40"
                        >
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {providerDef?.label}
                            {platformReady ? (
                              <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px] font-normal"
                              >
                                平台 Key 已配置 ✓
                              </Badge>
                            ) : hasKey ? (
                              <Badge
                                variant="secondary"
                                className="px-1.5 py-0 text-[10px] font-normal"
                              >
                                已配置自定义 Key
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                              >
                                未配置 Key
                              </Badge>
                            )}
                          </span>
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                        </button>
                        {isOpen && (
                          <div className="space-y-2 border-t border-border/60 p-3">
                            <Input
                              type="password"
                              value={form.apiKey}
                              onChange={(e) =>
                                handleKeyChange(providerId, e.target.value)
                              }
                              placeholder={
                                hasKey ? "已保存（留空则不修改）" : "输入 API Key（可选）"
                              }
                              className="h-9"
                              autoComplete="off"
                            />
                            <Input
                              value={form.baseUrl || providerDef?.baseURL || ""}
                              readOnly
                              aria-label={`${providerDef?.label} Base URL`}
                              className="h-9 text-muted-foreground"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-success" />
                    Key 使用 AES-256 加密后存入数据库，仅服务端调用时解密使用；留空则不修改已保存的 Key。
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>

      {/* sticky 保存配置 */}
      <div className="sticky bottom-4 z-10">
        <Button
          onClick={handleSave}
          disabled={saving || loading}
          className="w-full gap-1.5 shadow-lg"
        >
          {saving ? (
            <span className="size-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
          ) : (
            <Save className="size-4" />
          )}
          {saving ? "保存中…" : "保存配置"}
        </Button>
      </div>

      {/* 偏好设置 */}
      <Card className="rounded-2xl border-border/60 bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4 text-primary" />
            偏好设置
          </CardTitle>
          <CardDescription className="text-xs">
            个性化你的创作体验。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 主题风格 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">主题颜色</Label>
            <div className="flex flex-wrap items-center gap-3">
              {/* 预设主题圆点 */}
              {THEME_PRESETS.map((t) => {
                const selected = currentTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    title={t.name}
                    className={cn(
                      "size-8 rounded-full transition-all",
                      t.color,
                      selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      !selected && "hover:scale-110",
                    )}
                  />
                );
              })}
              {/* 自定义颜色选择器：拖拽中仅操作 DOM（零重渲染），松手/失焦时提交状态 */}
              <div className="relative">
                <input
                  type="color"
                  defaultValue={customColor}
                  onInput={(e) => {
                    const color = (e.target as HTMLInputElement).value;
                    applyCustomColorOnly(color);
                  }}
                  onBlur={(e) => setCustomColor(e.target.value)}
                  className={cn(
                    "size-8 cursor-pointer rounded-full border-0",
                    currentTheme === "custom" && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                  )}
                  style={{ padding: 0, background: "none" }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              点击预设快速切换，或使用取色器自由选择颜色
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
