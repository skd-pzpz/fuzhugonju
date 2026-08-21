import { create } from "zustand";

export type ToastType = "success" | "error" | "warning";

export type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastState = {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
};

let toastSeq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, type = "success") => {
    const id = `toast-${Date.now()}-${toastSeq++}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    // 3 秒后自动消失
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
