/**
 * 服务端 AES-256-GCM 加解密（用于自定义 API Key 落库加密）。
 * 密钥来自环境变量 ENCRYPTION_KEY（64 位十六进制 = 32 字节）。
 * 未配置密钥时降级为明文存储/读取（仅开发环境，日志会提示）。
 */
import crypto from "crypto";

const KEY_HEX = process.env.ENCRYPTION_KEY ?? "";

function getKey(): Buffer | null {
  if (!KEY_HEX) return null;
  try {
    const key = Buffer.from(KEY_HEX, "hex");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export const isEncryptionEnabled = () => getKey() !== null;

/** 加密：格式 `v1:<iv>:<authTag>:<ciphertext>`（base64） */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  const key = getKey();
  if (!key) {
    console.warn("[crypto] ENCRYPTION_KEY 未配置，自定义 API Key 将以明文存储（仅限开发环境）");
    return plain;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** 解密：兼容未加密的明文（无 v1: 前缀） */
export function decryptSecret(payload: string): string {
  if (!payload) return payload;
  if (!payload.startsWith("v1:")) return payload;
  const key = getKey();
  if (!key) return payload;
  try {
    const [, ivB64, tagB64, dataB64] = payload.split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
