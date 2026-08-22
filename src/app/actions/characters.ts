"use server";

import { and, asc, eq, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/db";
import { novels } from "@/db/schema";
import {
  characterAppearances,
  characters,
  chapters,
  scenes,
  type CustomField,
} from "@/db/schema";

/** 获取当前登录用户 ID，未登录则抛出异常 */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  return session.user.id;
}

/** 检查小说是否属于当前用户 */
async function requireNovelOwnership(novelId: string, userId: string): Promise<void> {
  const novel = await db.query.novels.findFirst({
    where: and(eq(novels.id, novelId), eq(novels.userId, userId)),
    columns: { id: true },
  });
  if (!novel) throw new Error("小说不存在或无权限");
}

/**
 * 删除角色：
 * 1. 先删除 character_appearances 中的关联出场记录（外键约束）
 * 2. 再删除 characters 记录
 * 使用 Drizzle 事务保证原子性。
 */
export async function deleteCharacter(characterId: string) {
  const userId = await requireUserId();

  try {
    // 先确认角色所属小说属于当前用户
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
      columns: { novelId: true },
    });
    if (!character) return { ok: false as const, error: "角色不存在" };
    await requireNovelOwnership(character.novelId, userId);

    await db.transaction(async (tx) => {
      await tx
        .delete(characterAppearances)
        .where(eq(characterAppearances.characterId, characterId));
      await tx.delete(characters).where(eq(characters.id, characterId));
    });
  } catch (error) {
    console.error("删除角色失败：", error);
    return { ok: false as const, error: "删除失败，请稍后重试" };
  }

  revalidatePath("/workspace/characters");
  revalidatePath("/novels/[id]/editor");
  return { ok: true as const };
}

/**
 * 批量删除角色：
 * 一次性查询所有角色归属，然后在单个事务中批量删除出场记录和角色。
 * 相比逐个调用 deleteCharacter，减少 N 次查询和 N 个事务的开销。
 */
export async function deleteCharacters(characterIds: string[]) {
  if (characterIds.length === 0) return { ok: false as const, error: "未选择角色" };

  const userId = await requireUserId();

  try {
    // 1. 一次性查询所有角色，确认归属
    const allChars = await db.query.characters.findMany({
      where: inArray(characters.id, characterIds),
      columns: { id: true, novelId: true },
    });

    if (allChars.length === 0) return { ok: false as const, error: "角色不存在" };

    // 2. 检查所有所属小说是否为本用户（去重后只查一次）
    const novelIds = [...new Set(allChars.map((c) => c.novelId))];
    for (const nid of novelIds) {
      await requireNovelOwnership(nid, userId);
    }

    const ids = allChars.map((c) => c.id);

    // 3. 单事务批量删除
    await db.transaction(async (tx) => {
      await tx
        .delete(characterAppearances)
        .where(inArray(characterAppearances.characterId, ids));
      await tx
        .delete(characters)
        .where(inArray(characters.id, ids));
    });
  } catch (error) {
    console.error("批量删除角色失败：", error);
    return { ok: false as const, error: "批量删除失败，请稍后重试" };
  }

  revalidatePath("/workspace/characters");
  revalidatePath("/novels/[id]/editor");
  return { ok: true as const };
}

export type CharacterDetail = {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  traits: string[] | null;
  background: string | null;
  appearance: string | null;
  abilities: string[] | null;
  goals: string | null;
  aliases: string[] | null;
  gender: string | null;
  age: string | null;
  occupation: string | null;
  faction: string | null;
  personalityTags: string[] | null;
  distinctiveFeatures: string | null;
  keyEvents: string[] | null;
  protagonistRelation: string | null;
  socialTendency: string | null;
  initialState: string | null;
  arcDirection: string | null;
  finalState: string | null;
  inspiration: string | null;
  authorNotes: string | null;
  customFields: CustomField[] | null;
  appearances: Array<{
    chapterTitle: string;
    chapterId: string;
    sceneSummary: string;
  }>;
};

/**
 * 获取角色完整信息 + 出场记录
 */
export async function getCharacterDetail(
  characterId: string,
): Promise<CharacterDetail | null> {
  const userId = await requireUserId();

  try {
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
      columns: {
        id: true,
        name: true,
        role: true,
        description: true,
        traits: true,
        background: true,
        appearance: true,
        abilities: true,
        goals: true,
        aliases: true,
        gender: true,
        age: true,
        occupation: true,
        faction: true,
        personalityTags: true,
        distinctiveFeatures: true,
        keyEvents: true,
        protagonistRelation: true,
        socialTendency: true,
        initialState: true,
        arcDirection: true,
        finalState: true,
        inspiration: true,
        authorNotes: true,
        customFields: true,
        novelId: true,
      },
    });

    if (!character) return null;
    await requireNovelOwnership(character.novelId, userId);

    // 获取出场记录：character_appearances → scenes → chapters
    const appearanceRows = await db
      .select({
        chapterTitle: chapters.title,
        chapterId: chapters.id,
        sceneSummary: scenes.summary,
      })
      .from(characterAppearances)
      .innerJoin(scenes, eq(scenes.id, characterAppearances.sceneId))
      .innerJoin(chapters, eq(chapters.id, scenes.chapterId))
      .where(eq(characterAppearances.characterId, characterId))
      .orderBy(asc(chapters.order), asc(scenes.order));

    return {
      ...character,
      appearances: appearanceRows.map((r) => ({
        chapterTitle: r.chapterTitle ?? "未命名章节",
        chapterId: r.chapterId,
        sceneSummary: r.sceneSummary ?? "",
      })),
    };
  } catch (error) {
    console.error("获取角色详情失败：", error);
    return null;
  }
}

/**
 * 更新角色字段（只保存传入的字段）
 */
export async function updateCharacter(
  characterId: string,
  data: Partial<Omit<CharacterDetail, "id" | "appearances">>,
) {
  const userId = await requireUserId();

  try {
    // 先确认角色所属小说属于当前用户
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
      columns: { novelId: true },
    });
    if (!character) return { ok: false as const, error: "角色不存在" };
    await requireNovelOwnership(character.novelId, userId);

    const [updated] = await db
      .update(characters)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(characters.id, characterId))
      .returning();

    if (!updated) {
      return { ok: false as const, error: "角色不存在" };
    }

    revalidatePath("/workspace/characters");
    revalidatePath("/novels/[id]/editor");
    return { ok: true as const, data: updated };
  } catch (error) {
    console.error("更新角色失败：", error);
    return { ok: false as const, error: "更新失败，请稍后重试" };
  }
}

/**
 * 构建角色简介文本，用于 AI 提示词注入
 * 返回格式化的纯文本，包含角色所有字段信息
 */
export async function getCharacterProfileText(
  characterId: string,
): Promise<string | null> {
  const userId = await requireUserId();

  try {
    const character = await db.query.characters.findFirst({
      where: eq(characters.id, characterId),
    });
    if (!character) return null;
    await requireNovelOwnership(character.novelId, userId);

    const lines: string[] = [];

    lines.push(`角色名称：${character.name}`);

    if (character.aliases?.length)
      lines.push(`别名/绰号：${character.aliases.join("、")}`);
    if (character.role) lines.push(`角色定位：${character.role}`);
    if (character.gender) lines.push(`性别：${character.gender}`);
    if (character.age) lines.push(`年龄：${character.age}`);
    if (character.occupation) lines.push(`职业/身份：${character.occupation}`);
    if (character.faction) lines.push(`阵营/势力：${character.faction}`);

    if (character.personalityTags?.length)
      lines.push(`性格标签：${character.personalityTags.join("、")}`);
    if (character.description) lines.push(`描述：${character.description}`);

    if (character.appearance) lines.push(`外貌描述：${character.appearance}`);
    if (character.distinctiveFeatures)
      lines.push(`显著特征：${character.distinctiveFeatures}`);

    if (character.background) lines.push(`背景经历：${character.background}`);
    if (character.keyEvents?.length)
      lines.push(`关键经历：${character.keyEvents.join("、")}`);
    if (character.abilities?.length)
      lines.push(`能力/特殊设定：${character.abilities.join("、")}`);
    if (character.goals) lines.push(`目标/动机：${character.goals}`);

    if (character.protagonistRelation)
      lines.push(`与主角关系：${character.protagonistRelation}`);
    if (character.socialTendency)
      lines.push(`社交倾向：${character.socialTendency}`);

    if (character.initialState) lines.push(`初始状态：${character.initialState}`);
    if (character.arcDirection) lines.push(`变化方向：${character.arcDirection}`);
    if (character.finalState) lines.push(`最终状态：${character.finalState}`);

    if (character.inspiration) lines.push(`创作灵感：${character.inspiration}`);
    if (character.authorNotes) lines.push(`作者备注：${character.authorNotes}`);

    if (character.customFields?.length) {
      lines.push("自定义字段：");
      for (const field of character.customFields) {
        lines.push(`  ${field.label}：${field.value}`);
      }
    }

    return lines.join("\n");
  } catch {
    return null;
  }
}