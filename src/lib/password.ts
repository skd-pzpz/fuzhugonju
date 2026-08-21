import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

/** 哈希密码，返回 salt:hash 格式的字符串 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

/** 验证密码与哈希值是否匹配 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuf = Buffer.from(key, "hex");
  if (buf.length !== keyBuf.length) return false;
  return timingSafeEqual(buf, keyBuf);
}