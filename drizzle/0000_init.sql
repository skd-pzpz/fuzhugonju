CREATE TABLE "novelcraft"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."authenticators" (
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"credential_public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"credential_device_type" text NOT NULL,
	"credential_backed_up" boolean DEFAULT false NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authenticators_user_id_credential_id_pk" PRIMARY KEY("user_id","credential_id")
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"novel_id" uuid NOT NULL,
	"title" text,
	"order" integer DEFAULT 0 NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"ai_analysis" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."character_appearances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"scene_id" uuid NOT NULL,
	"mention_type" text DEFAULT 'mention',
	"importance" integer DEFAULT 1,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"novel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"aliases" jsonb,
	"role" text,
	"gender" text,
	"age" text,
	"occupation" text,
	"faction" text,
	"personality_tags" jsonb,
	"traits" jsonb,
	"description" text,
	"appearance" text,
	"distinctive_features" text,
	"background" text,
	"key_events" jsonb,
	"abilities" jsonb,
	"goals" text,
	"protagonist_relation" text,
	"social_tendency" text,
	"initial_state" text,
	"arc_direction" text,
	"final_state" text,
	"inspiration" text,
	"author_notes" text,
	"custom_fields" jsonb,
	"source" text DEFAULT 'ai' NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT '新对话' NOT NULL,
	"mode" text DEFAULT 'general' NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"event_type" text,
	"position" integer DEFAULT 0 NOT NULL,
	"importance" integer DEFAULT 1,
	"related_character_ids" uuid[],
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."novels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"genre" text,
	"cover_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."passkey_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge" text NOT NULL,
	"purpose" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."passkey_login_tokens" (
	"token" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"character_a_id" uuid NOT NULL,
	"character_b_id" uuid NOT NULL,
	"relationship_type" text NOT NULL,
	"description" text,
	"strength" integer DEFAULT 50,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."scenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_id" uuid NOT NULL,
	"title" text,
	"order" integer DEFAULT 0 NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."user_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"ai_provider" text DEFAULT 'openai' NOT NULL,
	"api_key" text,
	"api_base_url" text,
	"model" text DEFAULT 'glm-4-flash',
	"provider" text DEFAULT 'zhipu' NOT NULL,
	"custom_api_key" text,
	"custom_base_url" text,
	"custom_model_name" text,
	"model_config" jsonb DEFAULT '{"global_default":{"provider":"zhipu","model":"glm-4-flash"},"character_extraction":{"provider":"zhipu","model":"glm-4-flash","use_global":true},"writer_block":{"provider":"zhipu","model":"glm-4-flash","use_global":true},"character_behavior":{"provider":"zhipu","model":"glm-4-flash","use_global":true},"storyline_analysis":{"provider":"zhipu","model":"glm-4-flash","use_global":true}}'::jsonb NOT NULL,
	"custom_keys" jsonb DEFAULT '{"zhipu":{"apiKey":"","baseUrl":"https://open.bigmodel.cn/api/paas/v4"},"deepseek":{"apiKey":"","baseUrl":"https://api.deepseek.com/v1"},"qwen":{"apiKey":"","baseUrl":"https://dashscope.aliyuncs.com/compatible-mode/v1"},"moonshot":{"apiKey":"","baseUrl":"https://api.moonshot.cn/v1"},"doubao":{"apiKey":"","baseUrl":"https://ark.cn-beijing.volces.com/api/v3"},"lingyi":{"apiKey":"","baseUrl":"https://api.lingyiwanwu.com/v1"},"minimax":{"apiKey":"","baseUrl":"https://api.minimax.chat/v1"}}'::jsonb NOT NULL,
	"default_novel_id" uuid,
	"preferences" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp,
	"image" text,
	"username" text NOT NULL,
	"password_hash" text,
	"theme" text DEFAULT 'default',
	"mode" text DEFAULT 'dark',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "novelcraft"."verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "novelcraft"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."authenticators" ADD CONSTRAINT "authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."chapters" ADD CONSTRAINT "chapters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."chapters" ADD CONSTRAINT "chapters_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novelcraft"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."character_appearances" ADD CONSTRAINT "character_appearances_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novelcraft"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."character_appearances" ADD CONSTRAINT "character_appearances_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "novelcraft"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."character_appearances" ADD CONSTRAINT "character_appearances_scene_id_scenes_id_fk" FOREIGN KEY ("scene_id") REFERENCES "novelcraft"."scenes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."characters" ADD CONSTRAINT "characters_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novelcraft"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."events" ADD CONSTRAINT "events_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novelcraft"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."events" ADD CONSTRAINT "events_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "novelcraft"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."novels" ADD CONSTRAINT "novels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."relationships" ADD CONSTRAINT "relationships_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novelcraft"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."relationships" ADD CONSTRAINT "relationships_character_a_id_characters_id_fk" FOREIGN KEY ("character_a_id") REFERENCES "novelcraft"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."relationships" ADD CONSTRAINT "relationships_character_b_id_characters_id_fk" FOREIGN KEY ("character_b_id") REFERENCES "novelcraft"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."scenes" ADD CONSTRAINT "scenes_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "novelcraft"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."scenes" ADD CONSTRAINT "scenes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "novelcraft"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novelcraft"."user_settings" ADD CONSTRAINT "user_settings_default_novel_id_novels_id_fk" FOREIGN KEY ("default_novel_id") REFERENCES "novelcraft"."novels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authenticators_credential_id_idx" ON "novelcraft"."authenticators" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "chapters_novel_idx" ON "novelcraft"."chapters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "chapters_user_id_idx" ON "novelcraft"."chapters" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_novel_order_uq" ON "novelcraft"."chapters" USING btree ("novel_id","order");--> statement-breakpoint
CREATE INDEX "appearances_character_idx" ON "novelcraft"."character_appearances" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "appearances_scene_idx" ON "novelcraft"."character_appearances" USING btree ("scene_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appearances_char_scene_uq" ON "novelcraft"."character_appearances" USING btree ("character_id","scene_id");--> statement-breakpoint
CREATE INDEX "characters_novel_idx" ON "novelcraft"."characters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "characters_name_idx" ON "novelcraft"."characters" USING btree ("name");--> statement-breakpoint
CREATE INDEX "chat_sessions_created_idx" ON "novelcraft"."chat_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_novel_idx" ON "novelcraft"."events" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "events_chapter_idx" ON "novelcraft"."events" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "novels_status_idx" ON "novelcraft"."novels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "novels_user_id_idx" ON "novelcraft"."novels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_challenges_user_id_idx" ON "novelcraft"."passkey_challenges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_challenges_expires_idx" ON "novelcraft"."passkey_challenges" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "passkey_login_tokens_expires_idx" ON "novelcraft"."passkey_login_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "relationships_novel_idx" ON "novelcraft"."relationships" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "relationships_char_a_idx" ON "novelcraft"."relationships" USING btree ("character_a_id");--> statement-breakpoint
CREATE INDEX "relationships_char_b_idx" ON "novelcraft"."relationships" USING btree ("character_b_id");--> statement-breakpoint
CREATE INDEX "scenes_chapter_idx" ON "novelcraft"."scenes" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "scenes_novel_idx" ON "novelcraft"."scenes" USING btree ("novel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_settings_user_id_uq" ON "novelcraft"."user_settings" USING btree ("user_id");