import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "";

// 仅允许在服务端使用，避免把连接字符串泄漏到浏览器
if (!connectionString) {
  throw new Error("DATABASE_URL 未配置，请检查 .env 文件");
}

const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });

export { client as sql };
