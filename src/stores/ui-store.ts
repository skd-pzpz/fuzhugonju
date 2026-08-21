import { create } from "zustand";

export type AIPanelRequestMode = "writer_block" | "character_advice";

interface UIState {
  /** 右侧 AI 助手面板是否展开 */
  isAIPanelOpen: boolean;
  setAIPanelOpen: (open: boolean) => void;
  toggleAIPanel: () => void;

  /** 当前编辑上下文（由编辑器写入，供 AI 面板读取章节场景） */
  activeNovelId: string | null;
  activeChapterId: string | null;
  setActiveContext: (novelId: string | null, chapterId: string | null) => void;

  /** 编辑器当前选中的文本（角色行为模式自动带入） */
  editorSelection: string;
  setEditorSelection: (text: string) => void;

  /** 编辑器注册的"插入文本到光标处"处理器（由 AI 面板「采用此方向」调用） */
  editorInsertHandler: ((content: string) => void) | null;
  setEditorInsertHandler: (handler: ((content: string) => void) | null) => void;

  /** 请求 AI 面板切换到某模式并带入文本（编辑器右键菜单触发） */
  aiPanelRequest: { mode: AIPanelRequestMode; text: string } | null;
  requestAIPanel: (mode: AIPanelRequestMode, text: string) => void;
  clearAIPanelRequest: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isAIPanelOpen: true,
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  toggleAIPanel: () => set((state) => ({ isAIPanelOpen: !state.isAIPanelOpen })),

  activeNovelId: null,
  activeChapterId: null,
  setActiveContext: (novelId, chapterId) =>
    set({ activeNovelId: novelId, activeChapterId: chapterId }),

  editorSelection: "",
  setEditorSelection: (text) => set({ editorSelection: text }),

  editorInsertHandler: null,
  setEditorInsertHandler: (handler) => set({ editorInsertHandler: handler }),

  aiPanelRequest: null,
  requestAIPanel: (mode, text) => set({ aiPanelRequest: { mode, text } }),
  clearAIPanelRequest: () => set({ aiPanelRequest: null }),
}));
