import { create } from "zustand";

export type ChatMode = "general" | "writer_block" | "character_advice";

export interface ChatSessionSummary {
  id: string;
  title: string;
  mode: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ChatSessionsState {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  historyOpen: boolean;
  loadSessions: () => Promise<void>;
  setCurrentSession: (id: string | null) => void;
  setHistoryOpen: (open: boolean) => void;
  toggleHistory: () => void;
  refreshSessions: () => Promise<void>;
  addSession: (session: ChatSessionSummary) => void;
  updateSession: (session: ChatSessionSummary) => void;
  removeSession: (id: string) => void;
}

export const useChatSessionsStore = create<ChatSessionsState>((set) => ({
  sessions: [],
  currentSessionId: null,
  historyOpen: false,

  loadSessions: async () => {
    try {
      const { listChatSessions } = await import(
        "@/app/actions/chat-sessions"
      );
      const list = await listChatSessions();
      set({ sessions: list });
    } catch {
      // silent
    }
  },

  setCurrentSession: (id) => set({ currentSessionId: id }),

  setHistoryOpen: (open) => set({ historyOpen: open }),

  toggleHistory: () => set((s) => ({ historyOpen: !s.historyOpen })),

  refreshSessions: async () => {
    try {
      const { listChatSessions } = await import(
        "@/app/actions/chat-sessions"
      );
      const list = await listChatSessions();
      set({ sessions: list });
    } catch {
      // silent
    }
  },

  addSession: (session) =>
    set((s) => ({ sessions: [session, ...s.sessions] })),

  updateSession: (session) =>
    set((s) => ({
      sessions: s.sessions.map((x) => (x.id === session.id ? session : x)),
    })),

  removeSession: (id) =>
    set((s) => ({
      sessions: s.sessions.filter((x) => x.id !== id),
    })),
}));
