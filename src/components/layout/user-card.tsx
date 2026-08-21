"use client";

import { Camera, Check, PencilLine } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRef, useState } from "react";

import { updateUserProfile, uploadAvatar } from "@/app/actions/user";

export function UserCard() {
  const { data: session, update } = useSession();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!session?.user) return null;

  const user = session.user;
  const avatarLetter = user.name?.[0] || "U";
  const hasAvatar = !!user.image;

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === user.name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await updateUserProfile({ name: trimmed });
      await update();
      setEditingName(false);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        await uploadAvatar(base64);
        await update();
      };
      reader.readAsDataURL(file);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-2">
        {/* Avatar */}
        <div className="relative size-8 shrink-0">
          {hasAvatar ? (
            <img
              src={user.image ?? undefined}
              alt="avatar"
              className="size-full rounded-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
              {avatarLetter}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs"
            title="更换头像"
          >
            <Camera className="size-2" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Name & Username */}
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1">
              <input
                className="h-6 w-full rounded bg-surface-elevated px-1.5 text-xs text-text-primary outline-none ring-1 ring-border"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
              />
              <button
                onClick={() => void handleSaveName()}
                disabled={saving}
                className="shrink-0 text-text-muted hover:text-primary"
              >
                <Check className="size-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <p className="truncate text-sm font-medium text-text-primary">
                {user.name}
              </p>
              <button
                onClick={() => {
                  setNameInput(user.name || "");
                  setEditingName(true);
                }}
                className="shrink-0 text-text-muted hover:text-primary"
                title="编辑昵称"
              >
                <PencilLine className="size-3" />
              </button>
            </div>
          )}
          <p className="truncate text-xs text-text-muted">
            {user.username || user.name}
          </p>
        </div>
      </div>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="mt-2 w-full rounded-md py-1 text-xs text-text-muted hover:bg-surface-elevated hover:text-danger"
      >
        {saving ? "保存中…" : "退出登录"}
      </button>
    </div>
  );
}