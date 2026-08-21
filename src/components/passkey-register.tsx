"use client";

import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  generatePasskeyRegistrationOptions,
  getUserPasskeyStatus,
  removeAllPasskeys,
  verifyPasskeyRegistration,
} from "@/app/actions/passkeys";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/stores/toast-store";

export default function PasskeyRegister() {
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyCount, setPasskeyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const result = await getUserPasskeyStatus();
    if (result.ok) {
      setHasPasskey(result.hasPasskey);
      setPasskeyCount(result.count);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      // 1. 获取注册选项
      const optionsResult = await generatePasskeyRegistrationOptions();
      if (!optionsResult.ok) {
        addToast(optionsResult.error, "error");
        return;
      }

      // 2. 浏览器层调用 WebAuthn API
      const regResponse = await startRegistration(optionsResult.options as any);

      // 3. 验证注册
      const verifyResult = await verifyPasskeyRegistration(regResponse as any);
      if (!verifyResult.ok) {
        addToast(verifyResult.error, "error");
        return;
      }

      addToast("Passkey 绑定成功！下次可使用指纹/面容快速登录");
      loadStatus();
    } catch (err: any) {
      if (err?.name === "SecurityError" || err?.name === "NotAllowedError") {
        addToast("操作已取消", "error");
      } else if (err?.name === "AbortError") {
        addToast("操作超时，请重试", "error");
      } else {
        const detail = err?.message || String(err);
        console.error("Passkey 绑定失败:", err);
        if (detail.includes("User ID") || detail.includes("User handle")) {
          addToast("用户标识长度异常，请联系开发者", "error");
        } else {
          addToast(`绑定失败：${detail}`, "error");
        }
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("确定解除所有 Passkey 绑定？")) return;
    setRemoving(true);
    const result = await removeAllPasskeys();
    if (result.ok) {
      addToast("已解除所有 Passkey 绑定");
      setHasPasskey(false);
      setPasskeyCount(0);
    } else {
      addToast(result.error ?? "解除绑定失败", "error");
    }
    setRemoving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="size-4 animate-spin" />
        加载中…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Fingerprint className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">指纹/面容登录</p>
            <p className="text-xs text-text-muted">
              {hasPasskey
                ? `已绑定 ${passkeyCount} 个设备`
                : "绑定后可用指纹或面容识别快速登录"}
            </p>
          </div>
        </div>
        {hasPasskey ? (
          <ShieldCheck className="size-5 text-success" />
        ) : (
          <ShieldX className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={handleRegister}
          disabled={registering}
          className="flex-1 gap-2"
        >
          {registering ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Fingerprint className="size-4" />
          )}
          {registering ? "绑定中…" : hasPasskey ? "重新绑定" : "绑定 Passkey"}
        </Button>
        {hasPasskey && (
          <Button
            type="button"
            variant="outline"
            onClick={handleRemove}
            disabled={removing}
            className="gap-2"
          >
            {removing ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            解除绑定
          </Button>
        )}
      </div>
    </div>
  );
}