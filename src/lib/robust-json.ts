/**
 * 健壮的 JSON 解析工具：用于所有模型（特别是 DeepSeek 这类不支持 response_format=json_object 的提供商）。
 *
 * 清理策略：
 * 1. 去除 Markdown 代码块标记（```json ... ``` / ``` ... ```）
 * 2. 去除前后说明文字，只保留第一个 `{` 到最后一个 `}` 之间的内容
 * 3. 如果还解析失败，尝试 JSON5 宽松解析（去掉 trailing comma、允许单引号等）—— 通过 regex 手动修复常见问题
 *
 * @param rawText AI 返回的原始文本
 * @param schema  Zod schema 用于结构校验（传入 undefined 跳过结构校验）
 * @returns 解析后的对象
 */
import type { z } from "zod";

export function robustJsonParse<T>(rawText: string, schema?: z.ZodType<T>): T {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("AI 返回为空");
  }

  const text = rawText;

  // 1) 去除 ```json ... ``` 或 ``` ... ``` 代码块
  let cleaned = text;
  const mdFence = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(cleaned.trim());
  if (mdFence && mdFence[1]) {
    cleaned = mdFence[1];
  }

  // 2) 去除前后文字，保留首个 { 到 最后一个 } 之间的部分（顶层对象）
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  } else {
    // 顶层是数组则取 [ ... ]
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleaned = cleaned.slice(firstBracket, lastBracket + 1);
    }
  }

  // 3) 常见兼容性修复
  // 3.1 去掉对象/数组末尾的 trailing comma:  [1,2,3,]  →  [1,2,3]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");

  // 4) JSON.parse 尝试（第 1 次：直接）
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (firstErr) {
    // 失败 → 5) 二次尝试：修复字符串值中存在的未转义换行（严格 JSON 不允许字符串里有真实换行，需要 \n）
    // 通过"状态机"扫描：不在字符串内时保留换行，在字符串内时把换行转义为 \n
    let result = "";
    let inStr = false;
    let quoteChar = "";
    let prevIsBackslash = false;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inStr) {
        if (ch === "\n" || ch === "\r") {
          result += "\\n";
          continue;
        }
        if (ch === "\t") {
          result += "\\t";
          continue;
        }
        if (!prevIsBackslash && ch === quoteChar) {
          inStr = false;
          quoteChar = "";
        }
        prevIsBackslash = !prevIsBackslash && ch === "\\";
        result += ch;
      } else {
        if (ch === '"' || ch === "'") {
          inStr = true;
          quoteChar = ch;
          prevIsBackslash = false;
        }
        result += ch;
      }
    }
    try {
      parsed = JSON.parse(result);
    } catch (secondErr) {
      const msg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      throw new Error(
        `JSON 解析失败：${msg}。原始片段：${cleaned.slice(0, 400)}`,
      );
    }
  }

  if (!schema) return parsed as T;

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}:${i.message}`)
      .join("; ");
    throw new Error(`返回结构不符合要求：${issues}`);
  }
  return result.data;
}
