"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (username.length < 3) {
      setError("用户名至少 3 个字符");
      return;
    }

    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn("username", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("用户名或密码错误");
      } else {
        router.push("/workspace");
        router.refresh();
      }
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (username.length < 3) {
      setError("用户名至少 3 个字符");
      return;
    }

    if (username.length > 20) {
      setError("用户名不能超过 20 个字符");
      return;
    }

    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次密码输入不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await res.json();

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccessMsg(result.message || "注册成功");
      setPassword("");
      setConfirmPassword("");
      setMode("login");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const switchToLogin = () => {
    setMode("login");
    setError("");
  };

  const switchToRegister = () => {
    setMode("register");
    setError("");
    setSuccessMsg("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-surface p-8">
        {/* Logo */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <span className="text-xl font-bold text-primary-foreground">N</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary">NovelCraft</h1>
          <p className="mt-1 text-sm text-text-muted">AI 辅助小说创作</p>
        </div>

        {mode === "register" ? (
          <>
            {/* 注册表单 */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-secondary">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  placeholder="请输入用户名"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-secondary">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="至少 6 位密码"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-secondary">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="再次输入密码"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}

              {successMsg && <p className="text-sm text-success">{successMsg}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary py-2.5 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? "注册中…" : "注册"}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={switchToLogin}
                className="text-xs text-text-muted hover:text-text-primary underline"
              >
                已有账号？立即登录
              </button>
            </div>
          </>
        ) : (
          <>
            {/* 登录表单 */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-secondary">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                    setSuccessMsg("");
                  }}
                  placeholder="请输入用户名"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-secondary">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                    setSuccessMsg("");
                  }}
                  placeholder="请输入密码"
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
                />
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
              {successMsg && <p className="text-sm text-success">{successMsg}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-primary py-2.5 text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
              >
                {loading ? "登录中…" : "登录"}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={switchToRegister}
                className="text-xs text-text-muted hover:text-text-primary underline"
              >
                没有账号？立即注册
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}