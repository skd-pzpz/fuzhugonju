import postgres from "postgres";

const connectionString = process.env.DATABASE_URL ?? "";
if (!connectionString) {
  console.error("DATABASE_URL 未配置");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function main() {
  console.log("开始执行用户数据隔离迁移...\n");

  // 1. 创建默认用户
  await sql`
    INSERT INTO "novelcraft"."users" ("phone", "name")
    VALUES ('13800000000', '默认用户')
    ON CONFLICT ("phone") DO NOTHING
  `;
  console.log("✓ 默认用户已创建");

  // 获取默认用户 ID
  const rows = await sql`SELECT id FROM "novelcraft"."users" WHERE phone = '13800000000' LIMIT 1`;
  const defaultUserId = rows[0]?.id;
  if (!defaultUserId) {
    console.error("无法获取默认用户 ID");
    process.exit(1);
  }
  console.log(`默认用户 ID: ${defaultUserId}\n`);

  // 2. 迁移 novels, chapters, characters, events
  const tables = ["novels", "chapters", "characters", "events"];
  for (const table of tables) {
    // 添加列（先 nullable）
    await sql.unsafe(
      `ALTER TABLE "novelcraft"."${table}" ADD COLUMN IF NOT EXISTS "user_id" uuid`,
    );
    // 回填数据
    await sql`
      UPDATE "novelcraft".${sql(table)} SET "user_id" = ${defaultUserId} WHERE "user_id" IS NULL
    `;
    // 设置 NOT NULL
    await sql.unsafe(
      `ALTER TABLE "novelcraft"."${table}" ALTER COLUMN "user_id" SET NOT NULL`,
    );
    // 添加外键
    await sql.unsafe(
      `ALTER TABLE "novelcraft"."${table}" ADD CONSTRAINT "${table}_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE CASCADE`,
    );
    console.log(`✓ ${table} 表迁移完成`);
  }

  // 3. 处理 user_settings
  // 回填：将 'local' 替换为默认用户 ID
  await sql`
    UPDATE "novelcraft"."user_settings" SET "user_id" = ${defaultUserId}::text WHERE "user_id" = 'local'
  `;
  // 变更列类型
  await sql.unsafe(
    `ALTER TABLE "novelcraft"."user_settings" ALTER COLUMN "user_id" SET DATA TYPE uuid USING "user_id"::uuid`,
  );
  // 添加外键
  await sql.unsafe(
    `ALTER TABLE "novelcraft"."user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "novelcraft"."users"("id") ON DELETE CASCADE`,
  );
  // 添加唯一约束（如果不存在，忽略冲突）
  try {
    await sql.unsafe(
      `ALTER TABLE "novelcraft"."user_settings" ADD CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")`,
    );
  } catch {
    console.log("  (唯一约束已存在，跳过)");
  }
  console.log("✓ user_settings 表迁移完成");

  // 4. 创建索引
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS "novels_user_id_idx" ON "novelcraft"."novels" USING btree ("user_id")`,
  );
  await sql.unsafe(
    `CREATE INDEX IF NOT EXISTS "chapters_user_id_idx" ON "novelcraft"."chapters" USING btree ("user_id")`,
  );
  console.log("✓ 索引创建完成");

  console.log("\n迁移完成！");
  await sql.end();
}

main().catch((err) => {
  console.error("迁移失败:", err);
  process.exit(1);
});