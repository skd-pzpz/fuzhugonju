import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  DEFAULT_CUSTOM_KEYS,
  DEFAULT_MODEL_CONFIG,
  type CustomKeys,
  type ModelConfig,
} from "@/lib/ai/modules";

/** 独立 schema，避免与其他项目共享 public 空间 */
const novelcraft = pgSchema("novelcraft");

/* ------------------------------------------------------------------ */
/*  novels —�?小说项目                                                  */
/* ------------------------------------------------------------------ */
export const novels = novelcraft.table(
  "novels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    genre: text("genre"),
    coverUrl: text("cover_url"),
    /** draft | ongoing | completed */
    status: text("status").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("novels_status_idx").on(table.status),
    index("novels_user_id_idx").on(table.userId),
  ],
);

/* ------------------------------------------------------------------ */
/*  chapters —�?章节                                                   */
/* ------------------------------------------------------------------ */
export const chapters = novelcraft.table(
  "chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    title: text("title"),
    /** 章节序号 */
    order: integer("order").default(0).notNull(),
    /** 章节正文（富文本 JSON / Markdown�?*/
    content: text("content").default("").notNull(),
    wordCount: integer("word_count").default(0).notNull(),
    /** draft | published */
    status: text("status").default("draft").notNull(),
    /** AI 对章节的分析结果（角色、事件等原始 JSON�?*/
    aiAnalysis: jsonb("ai_analysis").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("chapters_novel_idx").on(table.novelId),
    index("chapters_user_id_idx").on(table.userId),
    uniqueIndex("chapters_novel_order_uq").on(table.novelId, table.order),
  ],
);

/* ------------------------------------------------------------------ */
/*  scenes —�?场景（章节内按场景拆分）                                  */
/* ------------------------------------------------------------------ */
export const scenes = novelcraft.table(
  "scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    title: text("title"),
    order: integer("order").default(0).notNull(),
    content: text("content").default("").notNull(),
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("scenes_chapter_idx").on(table.chapterId),
    index("scenes_novel_idx").on(table.novelId),
  ],
);

/* ------------------------------------------------------------------ */
/*  characters —�?角色档案（AI 提取 + 用户确认�?                       */
/* ------------------------------------------------------------------ */
export const characters = novelcraft.table(
  "characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),

    /* ---- 基础信息 ---- */
    /** 别名/绰号 */
    aliases: jsonb("aliases").$type<string[]>(),
    /** 主角 / 配角 / 反派 / 路人 ... */
    role: text("role"),
    /** 性别：male / female / other / unknown */
    gender: text("gender"),
    /** 年龄 */
    age: text("age"),
    /** 职业/身份 */
    occupation: text("occupation"),
    /** 阵营/势力 */
    faction: text("faction"),

    /* ---- 性格特征 ---- */
    /** 性格标签（原 traits�?*/
    personalityTags: jsonb("personality_tags").$type<string[]>(),
    /** �?traits 字段兼容 */
    traits: jsonb("traits").$type<string[]>(),
    description: text("description"),

    /* ---- 外貌特征 ---- */
    appearance: text("appearance"),
    /** 显著特征 */
    distinctiveFeatures: text("distinctive_features"),

    /* ---- 背景经历 ---- */
    background: text("background"),
    /** 关键经历 */
    keyEvents: jsonb("key_events").$type<string[]>(),
    /** 能力 / 特殊设定 */
    abilities: jsonb("abilities").$type<string[]>(),
    /** 目标 / 动机 */
    goals: text("goals"),

    /* ---- 人际关系 ---- */
    /** 与主角关�?*/
    protagonistRelation: text("protagonist_relation"),
    /** 社交倾向 */
    socialTendency: text("social_tendency"),

    /* ---- 角色弧线 ---- */
    /** 初始状�?*/
    initialState: text("initial_state"),
    /** 变化方向 */
    arcDirection: text("arc_direction"),
    /** 最终状态（可空�?*/
    finalState: text("final_state"),

    /* ---- 创作备忘 ---- */
    /** 创作灵感来源 */
    inspiration: text("inspiration"),
    /** 作者备�?*/
    authorNotes: text("author_notes"),

    /* ---- 自定义字�?---- */
    customFields: jsonb("custom_fields").$type<CustomField[]>(),

    /** ai | manual */
    source: text("source").default("ai").notNull(),
    /** 用户是否已确认该角色 */
    isConfirmed: boolean("is_confirmed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("characters_novel_idx").on(table.novelId),
    index("characters_name_idx").on(table.name),
  ],
);

/* ------------------------------------------------------------------ */
/*  character_appearances —�?角色出场记录（关联角色与场景�?            */
/* ------------------------------------------------------------------ */
export const characterAppearances = novelcraft.table(
  "character_appearances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    characterId: uuid("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    sceneId: uuid("scene_id")
      .notNull()
      .references(() => scenes.id, { onDelete: "cascade" }),
    /** dialogue | action | mention */
    mentionType: text("mention_type").default("mention"),
    /** 重要程度 1-5 */
    importance: integer("importance").default(1),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("appearances_character_idx").on(table.characterId),
    index("appearances_scene_idx").on(table.sceneId),
    uniqueIndex("appearances_char_scene_uq").on(table.characterId, table.sceneId),
  ],
);

/* ------------------------------------------------------------------ */
/*  events —�?故事事件（用于故事线可视化）                              */
/* ------------------------------------------------------------------ */
export const events = novelcraft.table(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id").references(() => chapters.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    /** 转折�?/ 冲突 / 解决 / 伏笔 ... */
    eventType: text("event_type"),
    /** 事件在时间线上的顺序 */
    position: integer("position").default(0).notNull(),
    /** 重要程度 1-5 */
    importance: integer("importance").default(1),
    /** 关联角色 */
    relatedCharacterIds: uuid("related_character_ids").array(),
    /** 可视化坐标等额外数据 */
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("events_novel_idx").on(table.novelId),
    index("events_chapter_idx").on(table.chapterId),
  ],
);

/* ------------------------------------------------------------------ */
/*  relationships —�?角色关系                                          */
/* ------------------------------------------------------------------ */
export const relationships = novelcraft.table(
  "relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    novelId: uuid("novel_id")
      .notNull()
      .references(() => novels.id, { onDelete: "cascade" }),
    characterAId: uuid("character_a_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    characterBId: uuid("character_b_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    /** 亲人 / 朋友 / 敌人 / 恋人 / 师生 ... */
    relationshipType: text("relationship_type").notNull(),
    description: text("description"),
    /** 关系强度 0-100 */
    strength: integer("strength").default(50),
    status: text("status"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("relationships_novel_idx").on(table.novelId),
    index("relationships_char_a_idx").on(table.characterAId),
    index("relationships_char_b_idx").on(table.characterBId),
  ],
);

/* ------------------------------------------------------------------ */
/*  user_settings —�?用户设置（含自定�?API Key�?                     */
/* ------------------------------------------------------------------ */
export const userSettings = novelcraft.table(
  "user_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    /** dark | light */
    theme: text("theme").default("dark").notNull(),
    /** openai | anthropic | custom ... */
    aiProvider: text("ai_provider").default("openai").notNull(),
    /** 自定�?API Key（生产环境需加密存储�?*/
    apiKey: text("api_key"),
    apiBaseUrl: text("api_base_url"),
    /** 当前选中的模型（默认智谱免费模型�?*/
    model: text("model").default("glm-4-flash"),
    /** 模型提供商：zhipu | qwen | deepseek | moonshot | doubao | custom */
    provider: text("provider").default("zhipu").notNull(),
    /** 自定义提供商：API Key（AES-256 加密存储�?*/
    customApiKey: text("custom_api_key"),
    customBaseUrl: text("custom_base_url"),
    customModelName: text("custom_model_name"),
    /** 模块级模型配置（每个功能模块独立 provider + model�?*/
    modelConfig: jsonb("model_config")
      .$type<ModelConfig>()
      .default(DEFAULT_MODEL_CONFIG)
      .notNull(),
    /** 各提供商独立 Key 配置（apiKey 加密存储，baseUrl 明文�?*/
    customKeys: jsonb("custom_keys")
      .$type<CustomKeys>()
      .default(DEFAULT_CUSTOM_KEYS)
      .notNull(),
    defaultNovelId: uuid("default_novel_id").references(() => novels.id, {
      onDelete: "set null",
    }),
    preferences: jsonb("preferences").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("user_settings_user_id_uq").on(table.userId)],
);

/* ------------------------------------------------------------------ */
/*  chat_sessions —�?AI 对话会话                                       */
/* ------------------------------------------------------------------ */
export const chatSessions = novelcraft.table(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").default("新对话").notNull(),
    /** general | writer_block | character_advice */
    mode: text("mode").default("general").notNull(),
    /** UIMessage[] 完整消息列表（JSON�?*/
    messages: jsonb("messages").$type<unknown[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("chat_sessions_created_idx").on(table.createdAt)],
);

/* ------------------------------------------------------------------ */
/*  Auth.js 用户系统�?                                                 */
/* ------------------------------------------------------------------ */

export const users = novelcraft.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  username: text("username").unique().notNull(),
  passwordHash: text("password_hash"),
  theme: text("theme").default("default"),
  mode: text("mode").default("dark"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const accounts = novelcraft.table(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
);

export const sessions = novelcraft.table("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = novelcraft.table(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    pk: { columns: [table.identifier, table.token] },
  }),
);

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Relations                                                         */
/* ------------------------------------------------------------------ */
export const novelsRelations = relations(novels, ({ many }) => ({
  chapters: many(chapters),
  scenes: many(scenes),
  characters: many(characters),
  appearances: many(characterAppearances),
  events: many(events),
  relationships: many(relationships),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  novel: one(novels, {
    fields: [chapters.novelId],
    references: [novels.id],
  }),
  scenes: many(scenes),
  events: many(events),
}));

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  novel: one(novels, {
    fields: [scenes.novelId],
    references: [novels.id],
  }),
  chapter: one(chapters, {
    fields: [scenes.chapterId],
    references: [chapters.id],
  }),
  appearances: many(characterAppearances),
}));

export const charactersRelations = relations(characters, ({ one, many }) => ({
  novel: one(novels, {
    fields: [characters.novelId],
    references: [novels.id],
  }),
  appearances: many(characterAppearances),
  relationshipsAsA: many(relationships, {
    relationName: "characterARelationships",
  }),
  relationshipsAsB: many(relationships, {
    relationName: "characterBRelationships",
  }),
}));

export const characterAppearancesRelations = relations(
  characterAppearances,
  ({ one }) => ({
    novel: one(novels, {
      fields: [characterAppearances.novelId],
      references: [novels.id],
    }),
    character: one(characters, {
      fields: [characterAppearances.characterId],
      references: [characters.id],
    }),
    scene: one(scenes, {
      fields: [characterAppearances.sceneId],
      references: [scenes.id],
    }),
  }),
);

export const eventsRelations = relations(events, ({ one }) => ({
  novel: one(novels, {
    fields: [events.novelId],
    references: [novels.id],
  }),
  chapter: one(chapters, {
    fields: [events.chapterId],
    references: [chapters.id],
  }),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  novel: one(novels, {
    fields: [relationships.novelId],
    references: [novels.id],
  }),
  characterA: one(characters, {
    fields: [relationships.characterAId],
    references: [characters.id],
    relationName: "characterARelationships",
  }),
  characterB: one(characters, {
    fields: [relationships.characterBId],
    references: [characters.id],
    relationName: "characterBRelationships",
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  defaultNovel: one(novels, {
    fields: [userSettings.defaultNovelId],
    references: [novels.id],
  }),
}));

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** 角色自定义字�?*/
export type CustomField = {
  id: string;
  label: string;
  value: string;
};
export type Novel = typeof novels.$inferSelect;
export type NewNovel = typeof novels.$inferInsert;
export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;
export type Scene = typeof scenes.$inferSelect;
export type NewScene = typeof scenes.$inferInsert;
export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;
export type CharacterAppearance = typeof characterAppearances.$inferSelect;
export type NewCharacterAppearance = typeof characterAppearances.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
export type UserSetting = typeof userSettings.$inferSelect;
export type NewUserSetting = typeof userSettings.$inferInsert;
