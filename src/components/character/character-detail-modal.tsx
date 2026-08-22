"use client";

import { Loader2, Plus, Pencil, Trash2, X } from "lucide-react";
import { useState, useCallback, useEffect } from "react";

import { updateCharacter, type CharacterDetail } from "@/app/actions/characters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/ui/tag-input";
import { useToastStore } from "@/stores/toast-store";
import type { CustomField } from "@/db/schema";

function initials(name: string) {
  return name.trim().slice(0, 1) || "?";
}

const GENDER_OPTIONS = [
  { value: "男", label: "男" },
  { value: "女", label: "女" },
  { value: "其他", label: "其他" },
  { value: "未知", label: "未知" },
];

/* ---------- Section header ---------- */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

/* ---------- Field row (view mode) ---------- */
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}：</span>
      {children}
    </div>
  );
}

/* ---------- Placeholder ---------- */
function EmptyPlaceholder() {
  return (
    <span className="text-sm italic text-muted-foreground/50">
      （未填写）
    </span>
  );
}

/* ---------- Edit field wrapper ---------- */
function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm">
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/* ---------- Render value in view mode ---------- */
function ViewValue({
  value,
  type,
}: {
  value: unknown;
  type: "text" | "textarea" | "tags" | "tag-list" | "select";
}) {
  if (value === null || value === undefined || value === "") return null;
  if (value === "") return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (type === "tags") {
      return (
        <div className="flex flex-wrap gap-1">
          {(value as string[]).map((v, i) => (
            <Badge key={i} className="px-2 py-0.5 text-[11px] font-normal">
              {v}
            </Badge>
          ))}
        </div>
      );
    }
    // tag-list (key events)
    return (
      <ol className="list-inside list-decimal space-y-0.5 text-sm">
        {(value as string[]).map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ol>
    );
  }

  return <span className="whitespace-pre-wrap">{value as string}</span>;
}

/* ---------- The main component ---------- */
export function CharacterDetailModal({
  open,
  onOpenChange,
  detail,
  loading,
  error,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: CharacterDetail | null;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
}) {
  const addToast = useToastStore((s) => s.addToast);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const initForm = useCallback(() => {
    if (!detail) return;
    setForm({
      name: detail.name,
      aliases: detail.aliases ?? [],
      role: detail.role ?? "",
      gender: detail.gender ?? "",
      age: detail.age ?? "",
      occupation: detail.occupation ?? "",
      faction: detail.faction ?? "",
      personalityTags: detail.personalityTags ?? detail.traits ?? [],
      description: detail.description ?? "",
      appearance: detail.appearance ?? "",
      distinctiveFeatures: detail.distinctiveFeatures ?? "",
      background: detail.background ?? "",
      keyEvents: detail.keyEvents ?? [],
      abilities: detail.abilities ?? [],
      goals: detail.goals ?? "",
      protagonistRelation: detail.protagonistRelation ?? "",
      socialTendency: detail.socialTendency ?? "",
      initialState: detail.initialState ?? "",
      arcDirection: detail.arcDirection ?? "",
      finalState: detail.finalState ?? "",
      inspiration: detail.inspiration ?? "",
      authorNotes: detail.authorNotes ?? "",
      customFields: detail.customFields ?? [],
    });
  }, [detail]);

  // 当切换到其他角色时，退出编辑模式并重新初始化表单
  useEffect(() => {
    setEditing(false);
    if (detail) initForm();
  }, [detail, initForm]);

  const handleStartEdit = () => {
    initForm();
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const result = await updateCharacter(detail.id, form as any);
      if (result.ok) {
        addToast("角色信息已更新");
        setEditing(false);
        onRefresh();
      } else {
        addToast(result.error ?? "保存失败", "error");
      }
    } catch {
      addToast("保存失败", "error");
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addCustomField = () => {
    const fields: CustomField[] = (form.customFields as CustomField[]) ?? [];
    const newField: CustomField = {
      id: crypto.randomUUID(),
      label: "",
      value: "",
    };
    setField("customFields", [...fields, newField]);
  };

  const removeCustomField = (id: string) => {
    const fields: CustomField[] = (form.customFields as CustomField[]) ?? [];
    setField("customFields", fields.filter((f) => f.id !== id));
  };

  const updateCustomField = (id: string, key: "label" | "value", val: string) => {
    const fields: CustomField[] = (form.customFields as CustomField[]) ?? [];
    setField(
      "customFields",
      fields.map((f) => (f.id === id ? { ...f, [key]: val } : f)),
    );
  };

  const fv = (key: string): unknown => {
    return form[key] ?? (detail as any)?.[key] ?? null;
  };

  // Define sections
  const sections: Array<{
    id: string;
    label: string;
    fields: Array<{
      label: string;
      key: string;
      type: "text" | "textarea" | "tags" | "select" | "tag-list";
      options?: Array<{ value: string; label: string }>;
    }>;
  }> = [
    {
      id: "basic",
      label: "基础信息",
      fields: [
        { label: "姓名", key: "name", type: "text" },
        { label: "别名", key: "aliases", type: "tag-list" },
        { label: "性别", key: "gender", type: "select", options: GENDER_OPTIONS },
        { label: "年龄", key: "age", type: "text" },
        { label: "职业/身份", key: "occupation", type: "text" },
        { label: "阵营/势力", key: "faction", type: "text" },
        { label: "角色定位", key: "role", type: "text" },
      ],
    },
    {
      id: "personality",
      label: "性格与外貌",
      fields: [
        { label: "性格标签", key: "personalityTags", type: "tags" },
        { label: "描述", key: "description", type: "textarea" },
        { label: "外貌概述", key: "appearance", type: "textarea" },
        { label: "显著特征", key: "distinctiveFeatures", type: "text" },
      ],
    },
    {
      id: "background",
      label: "背景经历",
      fields: [
        { label: "出身背景", key: "background", type: "textarea" },
        { label: "关键经历", key: "keyEvents", type: "tag-list" },
        { label: "能力/特殊设定", key: "abilities", type: "tag-list" },
        { label: "目标/动机", key: "goals", type: "textarea" },
      ],
    },
    {
      id: "relationships",
      label: "人际关系",
      fields: [
        { label: "与主角关系", key: "protagonistRelation", type: "text" },
        { label: "社交倾向", key: "socialTendency", type: "textarea" },
      ],
    },
    {
      id: "arc",
      label: "角色弧线",
      fields: [
        { label: "初始状态", key: "initialState", type: "text" },
        { label: "变化方向", key: "arcDirection", type: "text" },
        { label: "最终状态", key: "finalState", type: "text" },
      ],
    },
    {
      id: "notes",
      label: "创作备忘",
      fields: [
        { label: "创作灵感来源", key: "inspiration", type: "textarea" },
        { label: "作者备注", key: "authorNotes", type: "textarea" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white">
                {detail ? initials(detail.name) : "?"}
              </span>
              {detail?.name ?? "角色详情"}
            </DialogTitle>
            {detail && !editing && (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Pencil className="size-3.5" />
                编辑
              </Button>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-5 pr-4">
              {editing && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  编辑模式：修改后请点击保存
                </div>
              )}

              {/* Fixed sections */}
              {sections.map((section) => (
                <div key={section.id}>
                  <SectionHeader>{section.label}</SectionHeader>
                  <div className="mt-2 space-y-2">
                    {section.fields.map((field) => {
                      const value = fv(field.key);

                      if (editing) {
                        return (
                          <EditField key={field.key} label={field.label}>
                            {renderEditField(field, value, (v) => setField(field.key, v))}
                          </EditField>
                        );
                      }

                      // View mode
                      const rendered = <ViewValue value={value} type={field.type} />;
                      if (rendered === null) return null;

                      return (
                        <FieldRow key={field.key} label={field.label}>
                          {rendered}
                        </FieldRow>
                      );
                    })}
                  </div>
                  <Separator className="mt-3" />
                </div>
              ))}

              {/* Custom fields */}
              <div>
                <div className="flex items-center justify-between">
                  <SectionHeader>自定义内容</SectionHeader>
                  {editing && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={addCustomField}>
                      <Plus className="size-3" />
                      添加字段
                    </Button>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {editing
                    ? renderCustomFieldsEdit(
                        form.customFields as CustomField[],
                        updateCustomField,
                        removeCustomField,
                      )
                    : renderCustomFieldsView(
                        form.customFields as CustomField[],
                      )}
                  {(!form.customFields || (form.customFields as CustomField[]).length === 0) && (
                    <EmptyPlaceholder />
                  )}
                </div>
                <Separator className="mt-3" />
              </div>

              {/* Appearances */}
              {detail.appearances.length > 0 && (
                <div>
                  <SectionHeader>出场记录（{detail.appearances.length} 处）</SectionHeader>
                  <div className="mt-2 space-y-2">
                    {detail.appearances.map((app, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-border/50 bg-muted/30 p-2.5"
                      >
                        <p className="text-xs font-medium">{app.chapterTitle}</p>
                        {app.sceneSummary && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {app.sceneSummary}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <p className="text-sm text-destructive">
              加载角色信息失败：{error}
            </p>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              重试加载
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            加载角色信息失败
          </div>
        )}

        {editing && (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={handleCancelEdit}>
              取消
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  保存中…
                </>
              ) : (
                "保存"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Edit field rendering ---------- */

function renderEditField(
  field: {
    type: string;
    options?: Array<{ value: string; label: string }>;
  },
  value: unknown,
  onChange: (v: unknown) => void,
) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[60px] text-sm"
        />
      );
    case "tags":
      return (
        <TagInput
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v)}
          placeholder="输入标签，按 Enter 添加"
        />
      );
    case "tag-list":
      return (
        <TagInput
          value={(value as string[]) ?? []}
          onChange={(v) => onChange(v)}
          placeholder="输入项目，按 Enter 添加"
        />
      );
    case "select":
      return (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          <option value="">（未选择）</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="text-sm"
        />
      );
  }
}

/* ---------- Custom fields view ---------- */

function renderCustomFieldsView(fields: CustomField[] | null | undefined) {
  if (!fields || fields.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((field) => (
        <div
          key={field.id}
          className="rounded-lg border border-border/50 bg-muted/30 p-2.5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {field.label || "（未命名）"}
          </p>
          <p className="mt-0.5 text-sm whitespace-pre-wrap">
            {field.value || <span className="italic text-muted-foreground/50">（空）</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------- Custom fields edit ---------- */

function renderCustomFieldsEdit(
  fields: CustomField[] | null | undefined,
  onUpdate: (id: string, key: "label" | "value", val: string) => void,
  onRemove: (id: string) => void,
) {
  const list = fields ?? [];
  if (list.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {list.map((field) => (
        <div
          key={field.id}
          className="relative rounded-lg border border-border/50 bg-muted/20 p-2.5 pr-8"
        >
          <button
            type="button"
            onClick={() => onRemove(field.id)}
            className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-destructive transition-colors"
            title="删除此字段"
          >
            <Trash2 className="size-3.5" />
          </button>
          <Input
            className="mb-1 h-7 text-xs font-semibold"
            placeholder="字段名"
            value={field.label}
            onChange={(e) => onUpdate(field.id, "label", e.target.value)}
          />
          <Textarea
            className="min-h-[40px] text-sm"
            placeholder="字段内容"
            value={field.value}
            onChange={(e) => onUpdate(field.id, "value", e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}