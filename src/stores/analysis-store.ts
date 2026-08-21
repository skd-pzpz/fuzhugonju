import { create } from "zustand";

import type { ExtractedCharacter } from "@/lib/analysis";
import type { AnalysisSceneResult } from "@/app/actions/analysis";

export type CharacterItemStatus = "pending" | "confirmed" | "ignored";

export type ExtractedCharacterItem = {
  key: string;
  sceneIndex: number;
  sceneId: string | null;
  sceneTitle: string;
  name: string;
  aliases: string[];
  age: string;
  occupation: string;
  faction: string;
  traits: string[];
  appearance: string;
  distinctive_features: string;
  background: string;
  key_events: string[];
  protagonist_relation: string;
  confidence: number;
  status: CharacterItemStatus;
};

export type AnalysisScene = {
  sceneIndex: number;
  sceneId: string | null;
  sceneTitle: string;
  characters: ExtractedCharacterItem[];
};

type AnalysisState = {
  status: "idle" | "analyzing" | "done" | "error";
  error: string | null;
  novelId: string | null;
  chapterId: string | null;
  scenes: AnalysisScene[];
  /** 最近一次分析完成的时间戳，用于触发 AI 面板自动切到提取标签页 */
  lastAnalysisAt: number | null;
  /** 实时进度文本 */
  progressText: string;
  /** 已用秒数 */
  elapsedSeconds: number;
  /** 分析使用的模型信息 */
  modelInfo: { provider: string; model: string } | null;

  startAnalysis: (novelId: string, chapterId: string) => void;
  setResults: (results: AnalysisSceneResult[]) => void;
  setProgress: (text: string, seconds: number) => void;
  setModelInfo: (info: { provider: string; model: string }) => void;
  failAnalysis: (error: string) => void;
  resetAnalysis: () => void;
  updateCharacter: (
    key: string,
    patch: Partial<Omit<ExtractedCharacterItem, "key" | "status">>,
  ) => void;
  markConfirmed: (key: string) => void;
  markIgnored: (key: string) => void;
  /** 按角色名从所有场景中移除（角色被删除时同步） */
  removeCharactersByName: (name: string) => void;
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  status: "idle",
  error: null,
  novelId: null,
  chapterId: null,
  scenes: [],
  lastAnalysisAt: null,
  progressText: "",
  elapsedSeconds: 0,
  modelInfo: null,

  startAnalysis: (novelId, chapterId) =>
    set({ status: "analyzing", error: null, novelId, chapterId, progressText: "正在读取章节内容…", elapsedSeconds: 0, modelInfo: null }),

  setProgress: (text, seconds) =>
    set({ progressText: text, elapsedSeconds: seconds }),

  setModelInfo: (info) =>
    set({ modelInfo: info }),

  setResults: (results) =>
    set((state) => {
      const scenes: AnalysisScene[] = results.map((scene) => {
        // 场景内按角色名去重，保留置信度更高的那条
        const byName = new Map<string, ExtractedCharacter>();
        for (const c of scene.characters) {
          const name = (c.name ?? "").trim();
          if (!name) continue;
          const prev = byName.get(name);
          if (!prev || (c.confidence ?? 0) > (prev.confidence ?? 0)) {
            byName.set(name, c);
          }
        }
        return {
          sceneIndex: scene.sceneIndex,
          sceneId: scene.sceneId,
          sceneTitle: scene.sceneTitle,
          characters: [...byName.values()].map((c, idx) => ({
            key: `${scene.sceneIndex}-${idx}`,
            sceneIndex: scene.sceneIndex,
            sceneId: scene.sceneId,
            sceneTitle: scene.sceneTitle,
            name: (c.name ?? "").trim(),
            aliases: c.aliases ?? [],
            age: c.age ?? "",
            occupation: c.occupation ?? "",
            faction: c.faction ?? "",
            traits: c.personality_tags ?? [],
            appearance: c.appearance ?? "",
            distinctive_features: c.distinctive_features ?? "",
            background: c.background ?? "",
            key_events: c.key_events ?? [],
            protagonist_relation: c.protagonist_relation ?? "",
            confidence: c.confidence,
            status: "pending" as const,
          })),
        };
      });
      return {
        status: "done",
        error: null,
        scenes,
        lastAnalysisAt: Date.now(),
      };
    }),

  failAnalysis: (error) =>
    set({
      status: "error",
      error,
      scenes: [],
      progressText: "",
      elapsedSeconds: 0,
      // 失败也触发 AI 面板自动切换到提取角色标签页
      lastAnalysisAt: Date.now(),
    }),

  resetAnalysis: () =>
    set({ status: "idle", error: null, novelId: null, chapterId: null, scenes: [], progressText: "", elapsedSeconds: 0, modelInfo: null }),

  updateCharacter: (key, patch) =>
    set((state) => ({
      scenes: state.scenes.map((scene) => ({
        ...scene,
        characters: scene.characters.map((c) =>
          c.key === key ? { ...c, ...patch } : c,
        ),
      })),
    })),

  markConfirmed: (key) =>
    set((state) => ({
      scenes: state.scenes.map((scene) => ({
        ...scene,
        characters: scene.characters.map((c) =>
          c.key === key ? { ...c, status: "confirmed" as const } : c,
        ),
      })),
    })),

  markIgnored: (key) =>
    set((state) => ({
      scenes: state.scenes.map((scene) => ({
        ...scene,
        characters: scene.characters.map((c) =>
          c.key === key ? { ...c, status: "ignored" as const } : c,
        ),
      })),
    })),

  removeCharactersByName: (name) =>
    set((state) => ({
      scenes: state.scenes
        .map((scene) => ({
          ...scene,
          characters: scene.characters.filter((c) => c.name !== name),
        }))
        .filter((scene) => scene.characters.length > 0),
    })),
}));
