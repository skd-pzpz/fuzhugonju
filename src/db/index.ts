import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ?? "";

// postgres() 不会立即连接，只有在查询时才真正建立连接
// 因此构建时即使没有 DATABASE_URL 也不会报错
const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });

export { client as sql };
