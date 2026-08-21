import { and, asc, eq } from "drizzle-orm";

import { characters, novels } from "@/db/schema";
import { db } from "@/db";
import { CharactersPageClient } from "./characters-page-client";

export type CharacterCardData = {
  id: string;
  name: string;
  role: string | null;
  traits: string[] | null;
  description: string | null;
};

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ novelId?: string }>;
}) {
  const { novelId: paramNovelId } = await searchParams;

  let novelTitle = "";
  let novelId: string | null = null;
  let confirmed: CharacterCardData[] = [];

  try {
    // 优先使用 URL 参数中的 novelId，否则取第一部小说
    let novel;
    if (paramNovelId) {
      novel = await db.query.novels.findFirst({
        where: eq(novels.id, paramNovelId),
        columns: { id: true, title: true },
      });
    }
    if (!novel) {
      novel = await db.query.novels.findFirst({
        orderBy: asc(novels.createdAt),
        columns: { id: true, title: true },
      });
    }

    if (novel) {
      novelId = novel.id;
      novelTitle = novel.title;
      confirmed = (await db.query.characters.findMany({
        where: and(
          eq(characters.novelId, novel.id),
          eq(characters.isConfirmed, true),
        ),
        orderBy: asc(characters.name),
        columns: {
          id: true,
          name: true,
          role: true,
          traits: true,
          description: true,
        },
      })) as CharacterCardData[];
    }
  } catch {
    // 数据库不可用，展示空状态
  }

  return (
    <CharactersPageClient
      novelTitle={novelTitle}
      novelId={novelId}
      confirmed={confirmed}
    />
  );
}