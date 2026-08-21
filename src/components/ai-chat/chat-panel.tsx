"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Bot,
  Check,
  Copy,
  Loader2,
  PenLine,
  RefreshCw,
  Send,
  Sparkles,
  Square,
  UserRound,
  UsersRound,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  parseCharacterReactions,
  parseWriterDirections,
  stripMarkdown,
  type CharacterReaction,
  type CharacterReactionLabel,
  type WriterDirection,
} from "@/lib/ai-chat-parse";
import { useToastStore } from "@/stores/toast-store";
import { useUIStore } from "@/stores/ui-store";
import { useChatSessionsStore } from "@/stores/chat-sessions-store";
import { cn } from "@/lib/utils";
import {
  createChatSession,
  getChatSession,
  updateChatSessionMessages,
} from "@/app/actions/chat-sessions";

/* AI 提供商名称映射（客户端使用） */
const PROVIDER_LABELS: Record<string, string> = {
  deepseek: "DeepSeek",
  zhipu: "智谱",
  qwen: "阿里云",
  moonshot: "月之暗面",
  doubao: "豆包",
  lingyi: "零一万物",
  minimax: "MiniMax",
};

/** 获取提供商中文/显示名 */
function getProviderLabel(providerId: string): string {
  return PROVIDER_LABELS[providerId] ?? providerId;
}

type ChatMode = "general" | "writer_block" | "character_advice";

const modeMeta: Record<
  ChatMode,
  { label: string; icon: LucideIcon; placeholder: string; hint: string }
> = {
  general: {
    label: "自由对话",
    icon: Bot,
    placeholder: "输入问题，Enter 发送，Shift+Enter 换行",
    hint: "任意提问",
  },
  writer_block: {
    label: "卡文建议",
    icon: Wand2,
    placeholder: "描述你的写作困境，例如：接下来怎么写？",
    hint: "读取当前章节最近 2 个场景，给出 3 个续写方向",
  },
  character_advice: {
    label: "角色行为",
    icon: PenLine,
    placeholder: "输入角色名，例如：林晚",
    hint: "基于角色档案 + 当前场景，分析可能的反应",
  },
};

/** 角色行为三个选项的配色（蓝 / 紫 / 橙） */
const reactionStyles: Record<
  CharacterReactionLabel,
  { border: string; badge: string }
> = {
  符合性格: {
    border: "border-blue-500/40",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  情理之中: {
    border: "border-violet-500/40",
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  突破常规: {
    border: "border-orange-500/40",
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
};

/** 从 UI 消息提取纯文本（v7 消息内容在 parts 中） */
function getMessageText(message: UIMessage): string {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => (part as { text?: string }).text ?? "")
    .join("");
}

/* ------------------------------------------------------------------ */
/*  欢迎块（按当前模式展示提示）                                        */
/* ------------------------------------------------------------------ */

function WelcomeBlock({ mode }: { mode: ChatMode }) {
  if (mode === "writer_block") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
          <Wand2 className="size-4" />
        </div>
        <p className="text-sm font-medium">卡文了？让我帮你续写</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          我会读取当前章节最近 2 个场景，
          <br />
          给出 3 个续写方向（情节概要 · 涉及角色 · 情绪走向）。
        </p>
      </div>
    );
  }
  if (mode === "character_advice") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
          <PenLine className="size-4" />
        </div>
        <p className="text-sm font-medium">分析角色可能的反应</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          输入角色名（或从编辑器选中后右键「查看行为建议」），
          <br />
          我会结合角色档案与当前场景给出 3 种反应选项。
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white">
        <Bot className="size-4" />
      </div>
      <p className="text-sm font-medium">你好，我是 NovelCraft 写作助手</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        你可以让我分析当前章节、提取角色信息，
        <br />
        或者针对「卡文」提供续写建议。
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  续写方向卡片                                                       */
/* ------------------------------------------------------------------ */

function WriterDirectionCards({
  directions,
  onAdopt,
}: {
  directions: WriterDirection[];
  onAdopt: (d: WriterDirection) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {directions.map((d, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/70 bg-card p-3"
        >
          <p className="text-[13px] font-semibold">{d.title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">
            {d.summary}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {d.characters && (
              <span className="text-[11px] text-muted-foreground">
                角色：{d.characters}
              </span>
            )}
            {d.mood && (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                情绪：{d.mood}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAdopt(d)}
            className="mt-2 h-6 gap-1 rounded-md text-[11px] text-primary"
          >
            <Wand2 className="size-3" />
            采用此方向
          </Button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  角色反应选项卡片（蓝 / 紫 / 橙）                                    */
/* ------------------------------------------------------------------ */

function CharacterReactionCards({
  reactions,
}: {
  reactions: CharacterReaction[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {reactions.map((r) => {
        const style = reactionStyles[r.label];
        return (
          <div
            key={r.label}
            className={cn("rounded-xl border bg-card p-3", style.border)}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  style.badge,
                )}
              >
                {r.label}
              </span>
              {r.title && (
                <p className="truncate text-[13px] font-semibold">{r.title}</p>
              )}
            </div>
            {r.content && (
              <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">
                {r.content}
              </p>
            )}
            {r.reason && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground/80">为什么这样做：</span>
                {r.reason}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  主组件                                                             */
/* ------------------------------------------------------------------ */

export function ChatPanel({ onOpenExtract }: { onOpenExtract?: () => void }) {
  const setAIPanelOpen = useUIStore((state) => state.setAIPanelOpen);
  const activeNovelId = useUIStore((state) => state.activeNovelId);
  const activeChapterId = useUIStore((state) => state.activeChapterId);
  const editorSelection = useUIStore((state) => state.editorSelection);
  const aiPanelRequest = useUIStore((state) => state.aiPanelRequest);
  const clearAIPanelRequest = useUIStore((state) => state.clearAIPanelRequest);
  const addToast = useToastStore((s) => s.addToast);

  // Shared chat session state
  const currentSessionId = useChatSessionsStore((s) => s.currentSessionId);
  const setCurrentSession = useChatSessionsStore((s) => s.setCurrentSession);
  const refreshSessions = useChatSessionsStore((s) => s.refreshSessions);
  const addSession = useChatSessionsStore((s) => s.addSession);

  const [mode, setMode] = useState<ChatMode>("general");
  const [input, setInput] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modelInfo, setModelInfo] = useState<{
    provider: string;
    model: string;
  } | null>(null);

  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // Load session when currentSessionId changes (from sidebar selection)
  useEffect(() => {
    if (!currentSessionId) return;
    void loadSession(currentSessionId);
  }, [currentSessionId]);

  const loadSession = async (sessionId: string) => {
    setLoadingSession(true);
    try {
      const session = await getChatSession(sessionId);
      if (session) {
        setMode((session.mode as ChatMode) || "general");
        setInitialMessages(session.messages as UIMessage[]);
      }
    } catch {
      addToast("加载会话失败", "error");
    } finally {
      setLoadingSession(false);
    }
  };

  const createNewSession = async () => {
    try {
      const session = await createChatSession(mode);
      addSession({
        id: session.id,
        title: session.title,
        mode: session.mode,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      });
      setCurrentSession(session.id);
      setInitialMessages([]);
      setInput("");
      setModelInfo(null);
      setMode((session.mode as ChatMode) || "general");
    } catch {
      addToast("创建会话失败", "error");
    }
  };

  const saveCurrentMessages = async (msgs: UIMessage[]) => {
    if (!currentSessionId) return;
    try {
      let title: string | undefined;
      if (msgs.length >= 2) {
        const firstUserMsg = msgs.find((m) => m.role === "user");
        if (firstUserMsg) {
          const text = getMessageText(firstUserMsg).slice(0, 30);
          if (text) title = text;
        }
      }
      await updateChatSessionMessages(currentSessionId, msgs, title, mode);
      await refreshSessions();
    } catch {
      // silent fail
    }
  };

  // 编辑器右键「查看行为建议」→ 打开面板并带入角色名
  useEffect(() => {
    if (!aiPanelRequest) return;
    setAIPanelOpen(true);
    setMode(aiPanelRequest.mode);
    setInput(aiPanelRequest.text);
    if (aiPanelRequest.mode === "character_advice") {
      characterNameRef.current = aiPanelRequest.text;
    }
    clearAIPanelRequest();
  }, [aiPanelRequest, setAIPanelOpen, clearAIPanelRequest]);

  // 最新值放入 ref，发送时由请求级 body 携带当前模式与上下文
  const modeRef = useRef(mode);
  const novelRef = useRef(activeNovelId);
  const chapterRef = useRef(activeChapterId);
  const characterNameRef = useRef("");
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    novelRef.current = activeNovelId;
  }, [activeNovelId]);
  useEffect(() => {
    chapterRef.current = activeChapterId;
  }, [activeChapterId]);

  const { messages, setMessages, sendMessage, status, error, stop, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        const provider = response.headers.get("X-Model-Provider");
        const model = response.headers.get("X-Model-Name");
        if (provider && model) {
          setModelInfo({ provider, model });
        }
        return response;
      },
    }),
    onFinish: async () => {
      if (messages.length > 0 && currentSessionId) {
        await saveCurrentMessages(messages);
      }
    },
  });

  // Load messages when initialMessages changes (session switched)
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  const busy = status === "submitted" || status === "streaming";

  const buildBody = () => {
    // 功能模块：卡文建议 / 角色行为 独立配置；自由对话不传 module（服务端兜底全局配置）
    const module =
      modeRef.current === "writer_block"
        ? "writer_block"
        : modeRef.current === "character_advice"
          ? "character_behavior"
          : undefined;
    return {
      mode: modeRef.current,
      novelId: novelRef.current,
      chapterId: chapterRef.current,
      characterName:
        modeRef.current === "character_advice"
          ? characterNameRef.current || undefined
          : undefined,
      module,
    };
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setModelInfo(null);

    // Auto-create session if none exists
    if (!currentSessionId) {
      try {
        const session = await createChatSession(mode);
        addSession({
          id: session.id,
          title: session.title,
          mode: session.mode,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        });
        setCurrentSession(session.id);
      } catch {
        addToast("创建会话失败", "error");
        return;
      }
    }

    sendMessage({ text }, { body: buildBody() });
    setInput("");
  };

  const handleRegenerate = () => {
    if (busy) return;
    setModelInfo(null);
    regenerate({ body: buildBody() });
  };

  const handleCopy = async (messageId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      addToast("复制失败", "error");
    }
  };

  const handleAdoptDirection = (d: WriterDirection) => {
    const insert = useUIStore.getState().editorInsertHandler;
    if (!insert) {
      addToast("请先在编辑器中打开一个章节", "error");
      return;
    }
    const content = stripMarkdown(
      `${d.title}\n${d.summary}${
        d.characters ? `\n涉及角色：${d.characters}` : ""
      }${d.mood ? `\n情绪走向：${d.mood}` : ""}`,
    );
    insert(content);
    addToast(`已采用「${d.title}」`);
  };

  const switchMode = async (next: ChatMode) => {
    setMode(next);
    // 立即持久化模式变更
    if (currentSessionId) {
      try {
        await updateChatSessionMessages(currentSessionId, messages, undefined, next);
        await refreshSessions();
      } catch {
        // silent
      }
    }
    // 进入角色行为模式：编辑器有选中文本且输入框为空时自动带入
    if (next === "character_advice" && editorSelection && !input.trim()) {
      setInput(editorSelection);
      characterNameRef.current = editorSelection;
    }
  };

  const importSelection = () => {
    if (editorSelection) {
      setInput(editorSelection);
      characterNameRef.current = editorSelection;
    }
  };

  const lastAssistantId = [...messages]
    .reverse()
    .find((m) => m.role === "assistant")?.id;

  const ModeIcon = modeMeta[mode].icon;

  return (
    <div className="flex h-full w-full flex-col">
      {/* 快捷操作 */}
      <div className="flex shrink-0 gap-2 px-4 py-3">
        <Button
          variant={mode === "writer_block" ? "secondary" : "outline"}
          size="sm"
            onClick={() => switchMode("writer_block")}
            className="flex-1 gap-1.5 rounded-full text-xs"
        >
          <Wand2 className="size-3.5 text-primary" />
          卡文建议
        </Button>
        <Button
          variant={mode === "character_advice" ? "secondary" : "outline"}
          size="sm"
          onClick={() => switchMode("character_advice")}
          className="flex-1 gap-1.5 rounded-full text-xs"
        >
          <PenLine className="size-3.5 text-primary" />
          角色行为
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenExtract}
          className="flex-1 gap-1.5 rounded-full text-xs"
        >
          <UsersRound className="size-3.5 text-primary" />
          提取角色
        </Button>
      </div>

      {/* 当前模式提示条 */}
      {mode !== "general" && (
        <div className="flex shrink-0 items-center gap-2 border-y border-border/60 bg-muted/30 px-3 py-1.5">
          <Badge
            variant="secondary"
            className="h-5 shrink-0 gap-1 rounded-md px-2 text-[11px]"
          >
            <ModeIcon className="size-3" />
            {modeMeta[mode].label}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {modeMeta[mode].hint}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMode("general")}
            aria-label="退出当前模式"
            className="size-6 text-muted-foreground"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      <Separator />

      {/* 当前使用的模型信息 */}
      {modelInfo && (
        <div className="flex shrink-0 items-center justify-center gap-1.5 px-4 py-1.5">
          <div className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-0.5">
            <Sparkles className="size-2.5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              使用 {getProviderLabel(modelInfo.provider)} · {modelInfo.model}
            </span>
          </div>
        </div>
      )}

      {/* 消息列表 */}
      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 ? (
            <WelcomeBlock mode={mode} />
          ) : (
            messages.map((message) => {
              const text = getMessageText(message);
              const isUser = message.role === "user";
              const isLastAssistant =
                !isUser && message.id === lastAssistantId;
              // 按内容解析结构化卡片（续写方向 / 角色反应）
              const directions =
                !isUser && mode === "writer_block"
                  ? parseWriterDirections(text)
                  : [];
              const reactions =
                !isUser && mode === "character_advice"
                  ? parseCharacterReactions(text)
                  : [];
              const showCards = directions.length > 0 || reactions.length > 0;

              return (
                <div
                  key={message.id}
                  className={cn("flex flex-col gap-1.5", isUser && "items-end")}
                >
                  <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full",
                        isUser
                          ? "bg-muted text-muted-foreground"
                          : "bg-gradient-to-br from-primary to-accent text-white",
                      )}
                    >
                      {isUser ? (
                        <UserRound className="size-3.5" />
                      ) : (
                        <Bot className="size-3.5" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                        isUser
                          ? "bg-gradient-to-br from-primary to-accent text-white"
                          : "bg-muted/60 text-foreground",
                      )}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap">{text}</p>
                      ) : showCards ? (
                        <div className="flex flex-col gap-2">
                          {directions.length > 0 && (
                            <WriterDirectionCards
                              directions={directions}
                              onAdopt={handleAdoptDirection}
                            />
                          )}
                          {reactions.length > 0 && (
                            <CharacterReactionCards reactions={reactions} />
                          )}
                        </div>
                      ) : (
                        <div className="ai-markdown">
                          <ReactMarkdown>{text}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI 消息操作：复制 / 重新生成 */}
                  {!isUser && (
                    <div className="flex items-center gap-0.5 pl-9">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopy(message.id, text)}
                        aria-label="复制消息"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      >
                        {copiedId === message.id ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </Button>
                      {isLastAssistant && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={handleRegenerate}
                          disabled={busy}
                          aria-label="重新生成"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        >
                          <RefreshCw className="size-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* 加载状态（可停止） */}
          {busy && (
            <div className="flex gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white">
                <Bot className="size-3.5" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3.5 py-2 text-[13px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {status === "submitted" ? "AI 生成中…" : "正在生成…"}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => stop()}
                  aria-label="停止生成"
                  className="size-6 text-muted-foreground hover:text-foreground"
                >
                  <Square className="size-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 编辑器选区导入（角色行为模式） */}
      {mode === "character_advice" && editorSelection && (
        <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            编辑器选中：{editorSelection}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={importSelection}
            className="h-6 gap-1 rounded-md px-2 text-[11px]"
          >
            带入输入框
          </Button>
        </div>
      )}

      {/* 输入区 */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={modeMeta[mode].placeholder}
            className="min-h-20 resize-none pr-11 text-[13px]"
            rows={3}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || busy}
            className="absolute bottom-2.5 right-2.5 size-7"
            aria-label="发送"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {error ? (
            <span className="text-destructive">请求失败：{error.message}</span>
          ) : (
            "AI 生成的内容仅供参考，请以你的创作为准。"
          )}
        </p>
      </div>
    </div>
  );
}
