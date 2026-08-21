"use server";

import { and, eq, lt } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { headers } from "next/headers";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  authenticators,
  passkeyChallenges,
  passkeyLoginTokens,
  users,
} from "@/db/schema";

/* ------------------------------------------------------------------ */
/*  RP 配置                                                             */
/* ------------------------------------------------------------------ */

/**
 * 获取 WebAuthn RP 配置。
 * 优先使用环境变量；未设置时自动从请求头推导，
 * 避免部署后 origin/rpID 仍为 localhost 导致验证失败。
 */
async function getRpConfig() {
  const rpName = process.env.WEBAUTHN_RP_NAME ?? "NovelCraft";

  // 环境变量优先
  const envRpID = process.env.WEBAUTHN_RP_ID;
  const envOrigin = process.env.WEBAUTHN_ORIGIN;

  if (envRpID && envOrigin) {
    return { rpName, rpID: envRpID, origin: envOrigin };
  }

  // 从请求头自动推导
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost";
  // x-forwarded-proto 可能是 "https, ..." 形式
  const rawProto = hdrs.get("x-forwarded-proto") ?? "";
  const proto = rawProto.split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");

  const origin = `${proto}://${host}`;
  // rpID 是不带端口的域名
  const rpID = host.split(":")[0];

  return { rpName, rpID, origin };
}

/* ------------------------------------------------------------------ */
/*  工具函数                                                             */
/* ------------------------------------------------------------------ */

/** 清理已过期的 challenge 和 loginToken */
async function cleanExpired() {
  const now = new Date();
  await db
    .delete(passkeyChallenges)
    .where(lt(passkeyChallenges.expiresAt, now));
  await db
    .delete(passkeyLoginTokens)
    .where(lt(passkeyLoginTokens.expiresAt, now));
}

/** 获取当前登录用户 ID */
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("未登录");
  return session.user.id;
}

/**
 * 生成稳定的 WebAuthn userID（user handle）字符串。
 * ——@simplewebauthn/server v9 的 userID 参数要求 string，
 * 内部会以 UTF-8 编码后发给浏览器/Authenticator，要求 ≤ 64 字节。
 * 做法：对用户 UUID 做 SHA-256，取前 32 字节，转 Base64URL（43 字符），
 * UTF-8 编码后仍是 43 字节，远低于 64 字节上限，稳定、唯一、不可反向。
 */
async function createWebAuthnUserHandle(userId: string): Promise<string> {
  const data = new TextEncoder().encode(userId);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data), 0, 32);
  // Uint8Array -> base64url (无 padding)
  let binary = "";
  for (let i = 0; i < hash.length; i++) binary += String.fromCharCode(hash[i]);
  const b64 = Buffer.from(binary, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ------------------------------------------------------------------ */
/*  注册。 Passkey                                                       */
/* ------------------------------------------------------------------ */

export type RegistrationOptionsResult =
  | { ok: true; options: PublicKeyCredentialCreationOptions }
  | { ok: false; error: string };

/**
 */
export async function generatePasskeyRegistrationOptions(): Promise<RegistrationOptionsResult> {
  try {
    const userId = await requireUserId();
    await cleanExpired();

    const { rpName, rpID } = await getRpConfig();

    // 查询用户名作为 userName（比 UUID 可读性更好，且不会影响唯一性，唯一性由 userID 保证）
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { username: true, name: true },
    });
    const userName = userRecord?.username ?? userId.slice(0, 8);
    const userDisplayName = userRecord?.name ?? userRecord?.username ?? "NovelCraft 用户";

    // 获取用户已有的凭证 ID
    const existingCreds = await db.query.authenticators.findMany({
      where: eq(authenticators.userId, userId),
      columns: { credentialID: true },
    });
    const excludeCredentials = existingCreds.map((c) => ({
      id: c.credentialID,
      type: "public-key" as const,
    }));

    const userHandle = await createWebAuthnUserHandle(userId);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName,
      userDisplayName,
      userID: userHandle,
      attestationType: "none",
      excludeCredentials: excludeCredentials as any,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
    });

    // 存储 challenge，5 分钟过期
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.insert(passkeyChallenges).values({
      userId,
      challenge: options.challenge,
      purpose: "registration",
      expiresAt,
    });
    return { ok: true, options: options as unknown as PublicKeyCredentialCreationOptions };
  } catch (error) {
    console.error("生成注册选项失败:", error);
    return { ok: false, error: "生成注册选项失败，请稍后重试" };
  }
}
export type VerifyRegistrationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * 验证注册响应，存?authenticators 表? */
export async function verifyPasskeyRegistration(
  credential: any,
): Promise<VerifyRegistrationResult> {
  try {
    const userId = await requireUserId();
    await cleanExpired();

    const { rpID, origin } = await getRpConfig();

    // 查找最近的 registration challenge
    const challenge = await db.query.passkeyChallenges.findFirst({
      where: and(
        eq(passkeyChallenges.userId, userId),
        eq(passkeyChallenges.purpose, "registration"),
      ),
      orderBy: (t, { desc }) => desc(t.createdAt),
    });

    if (!challenge) {
      return { ok: false, error: "未找到注册挑战，请重新开始"};
    }

    if (challenge.expiresAt < new Date()) {
      await db.delete(passkeyChallenges).where(eq(passkeyChallenges.id, challenge.id));
      return { ok: false, error: "注册挑战已过期，请重新开始"};
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return { ok: false, error: "验证失败，请重试" };
    }

    const { registrationInfo } = verification;

    // 保存凭证
    await db.insert(authenticators).values({
      userId,
      credentialID: credential.id,
      credentialPublicKey: registrationInfo.credentialPublicKey
        ? Buffer.from(registrationInfo.credentialPublicKey).toString("base64url")
        : "",
      counter: registrationInfo.counter,
      credentialDeviceType: registrationInfo.credentialDeviceType,
      credentialBackedUp: registrationInfo.credentialBackedUp,
      transports: credential.response?.transports ?? [],
    });

    // 删除已使用的 challenge
    await db.delete(passkeyChallenges).where(eq(passkeyChallenges.id, challenge.id));

    return { ok: true, message: "Passkey 绑定成功" };
  } catch (error) {
    console.error("验证注册失败:", error);
    const msg = error instanceof Error ? error.message : String(error);
    // 向用户暴露有用的错误信息
    if (msg.includes("origin") || msg.includes("Origin")) {
      return { ok: false, error: "域名配置不匹配，请联系管理员检查 WEBAUTHN_RP_ID 和 WEBAUTHN_ORIGIN" };
    }
    if (msg.includes("challenge") || msg.includes("Challenge")) {
      return { ok: false, error: "注册挑战验证失败，请重试" };
    }
    return { ok: false, error: `绑定失败：${msg}` };
  }
}

/* ------------------------------------------------------------------ */
/*  认证 Passkey（登录）                                                */
/* ------------------------------------------------------------------ */

export type AuthOptionsResult =
  | { ok: true; options: PublicKeyCredentialRequestOptions }
  | { ok: false; error: string };

/**
 * 未登录用户输入用户名后调用，生成认证选项
 * 如果用户名不存在，直接返回错误，让用户先使用用户名注册
 */
export async function generatePasskeyAuthOptions(
  username: string,
): Promise<AuthOptionsResult> {
  try {
    if (username.length < 3) {
      return { ok: false, error: "请输入正确的用户名" };
    }

    await cleanExpired();

    const { rpID } = await getRpConfig();

    // 查找用户
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (!user) {
      return { ok: false, error: "该用户名未注册" };
    }

    // 获取该用户的凭证
    const userCreds = await db.query.authenticators.findMany({
      where: eq(authenticators.userId, user.id),
    });
    if (userCreds.length === 0) {
      return { ok: false, error: "该账号尚未绑定 Passkey" };
    }

    const allowCredentials = userCreds.map((cred) => ({
      id: cred.credentialID,
      type: "public-key" as const,
      transports: cred.transports as any,
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: allowCredentials as any,
      userVerification: "preferred",
    });

    // 存储 challenge
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await db.insert(passkeyChallenges).values({
      userId: user.id,
      challenge: options.challenge,
      purpose: "authentication",
      expiresAt,
    });

    return { ok: true, options: options as unknown as PublicKeyCredentialRequestOptions };
  } catch (error) {
    console.error("生成认证选项失败:", error);
    return { ok: false, error: "Passkey 登录失败，请稍后重试" };
  }
}

export type VerifyAuthResult =
  | { ok: true; loginToken: string }
  | { ok: false; error: string };

/**
 * 验证认证响应，通过后生成一次性 loginToken（60 秒过期）
 */
export async function verifyPasskeyAuthentication(
  credential: any,
  username: string,
): Promise<VerifyAuthResult> {
  try {
    if (username.length < 3) {
      return { ok: false, error: "请输入正确的用户名" };
    }

    await cleanExpired();

    const { rpID, origin } = await getRpConfig();

    // 查找用户
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (!user) {
      return { ok: false, error: "该用户名未注册" };
    }

    // 查找 challenge
    const challenge = await db.query.passkeyChallenges.findFirst({
      where: and(
        eq(passkeyChallenges.userId, user.id),
        eq(passkeyChallenges.purpose, "authentication"),
      ),
      orderBy: (t, { desc }) => desc(t.createdAt),
    });

    if (!challenge) {
      return { ok: false, error: "未找到认证挑战，请重新开始"};
    }

    if (challenge.expiresAt < new Date()) {
      await db.delete(passkeyChallenges).where(eq(passkeyChallenges.id, challenge.id));
      return { ok: false, error: "认证挑战已过期，请重新开始" };
    }

    // 查找凭证
    const credentialRecord = await db.query.authenticators.findFirst({
      where: and(
        eq(authenticators.userId, user.id),
        eq(authenticators.credentialID, credential.id),
      ),
    });

    if (!credentialRecord) {
      return { ok: false, error: "未找到对应的 Passkey 凭证" };
    }

    // 验证认证
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialRecord.credentialID,
        publicKey: new Uint8Array(
          Buffer.from(credentialRecord.credentialPublicKey, "base64url"),
        ),
        counter: credentialRecord.counter,
        transports: credentialRecord.transports as AuthenticatorTransport[],
      },
    } as any);

    if (!verification.verified) {
      return { ok: false, error: "Passkey 验证失败，请重试" };
    }

    // 更新 counter（防重放）
    await db.update(authenticators)
      .set({ counter: verification.authenticationInfo.newCounter, updatedAt: new Date() })
      .where(
        and(
          eq(authenticators.userId, user.id),
          eq(authenticators.credentialID, credential.id),
        ),
      );

    // 删除已使用的 challenge
    await db.delete(passkeyChallenges).where(eq(passkeyChallenges.id, challenge.id));

    // 生成一次性登录令牌（30 秒过期）
    const tokenExpiresAt = new Date(Date.now() + 30 * 1000);
    const [loginToken] = await db
      .insert(passkeyLoginTokens)
      .values({
        userId: user.id,
        expiresAt: tokenExpiresAt,
      })
      .returning({ token: passkeyLoginTokens.token });

    if (!loginToken) {
      return { ok: false, error: "生成登录令牌失败" };
    }

    return { ok: true, loginToken: loginToken.token };
  } catch (error) {
    console.error("验证认证失败:", error);
    return { ok: false, error: "Passkey 验证失败，请重试" };
  }
}

/* ------------------------------------------------------------------ */
/*  查询用户是否已绑定 Passkey                                          */
/* ------------------------------------------------------------------ */

export type PasskeyStatusResult =
  | { ok: true; hasPasskey: boolean; count: number }
  | { ok: false; error: string };

/**
 * 查询当前登录用户是否已绑定 Passkey（用于前端显示）
 */
export async function getUserPasskeyStatus(): Promise<PasskeyStatusResult> {
  try {
    const userId = await requireUserId();
    const creds = await db.query.authenticators.findMany({
      where: eq(authenticators.userId, userId),
      columns: { credentialID: true },
    });
    return { ok: true, hasPasskey: creds.length > 0, count: creds.length };
  } catch (error) {
    return { ok: false, error: "查询失败" };
  }
}

/**
 * 删除用户的所?Passkey（解除绑定）
 */
export async function removeAllPasskeys(): Promise<{ ok: boolean; error?: string }> {
  try {
    const userId = await requireUserId();
    await db.delete(authenticators).where(eq(authenticators.userId, userId));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: "解除绑定失败" };
  }
}
