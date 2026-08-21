"use client";

import { startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  generatePasskeyAuthOptions,
  verifyPasskeyAuthentication,
} from "@/app/actions/passkeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToastStore } from "@/stores/toast-store";

export default function PasskeyLogin() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  const handlePasskeyLogin = async () => {
    if (username.length < 3) {
      setError("请输入正确的用户名");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const optionsResult = await generatePasskeyAuthOptions(username);
      if (!optionsResult.ok) {
        setError(optionsResult.error);
        return;
      }
      const authResponse = await startAuthentication(optionsResult.options as any);
      const verifyResult = await verifyPasskeyAuthentication(authResponse as any, username);
      if (!verifyResult.ok) {
        setError(verifyResult.error);
        return;
      }
      const result = await signIn("passkey", {
        loginToken: verifyResult.loginToken,
        redirect: false,
      });
      if (result?.error) {
        setError("登录失败，请重试");
        return;
      }
      addToast("Passkey 登录成功");
      router.push("/workspace");
      router.refresh();
    } catch (err: any) {
      if (err?.name === "SecurityError" || err?.name === "NotAllowedError") {
        setError("Passkey 验证已取消或设备不支持");
      } else {
        console.error("Passkey 登录失败:", err);
        setError("Passkey 登录失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-text-secondary">用户名</label>
        <Input
          type="text"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError("");
          }}
          placeholder="请输入绑定的用户名"
          className="mt-1"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button
        type="button"
        onClick={handlePasskeyLogin}
        disabled={loading}
        className="w-full gap-2"
      >
        {loading ? (
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Fingerprint className="size-4" />
        )}
        {loading ? "验证中…" : "使用指纹/面容登录"}
      </Button>
      <p className="text-center text-xs text-text-muted">
        支持指纹、面容识别或设备 PIN 码
      </p>
    </div>
  );
}
