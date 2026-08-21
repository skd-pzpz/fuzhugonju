"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeName =
  | "default"
  | "amber"
  | "forest"
  | "slate"
  | "sakura"
  | "ocean"
  | "custom";

export type FontOption =
  | "system"
  | "kaiti"
  | "songti"
  | "heiti"
  | "fangsong"
  | "yahei"
  | "custom";

const THEME_KEY = "novelcraft-theme";
const MODE_KEY = "novelcraft-mode";
const COLOR_KEY = "novelcraft-custom-color";
const FONT_KEY = "novelcraft-font-family";
const FONT_CUSTOM_KEY = "novelcraft-font-custom";
const LAST_PRESET_KEY = "novelcraft-last-preset-theme";

const DEFAULT_CUSTOM_COLOR = "#6366f1";

/** 将 hex 颜色转为 RGB 三元组 */
function hexToRgbTriple(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

/** 生成更亮的颜色（hover 用） */
function lightenHex(hex: string, amount = 0.25): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

/** 色相偏移得到 accent 色 */
function accentFromHex(hex: string, shift = 30): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hh = 0;
  if (max === min) hh = 0;
  else if (max === r) hh = 60 * (0 + (g - b) / (max - min));
  else if (max === g) hh = 60 * (2 + (b - r) / (max - min));
  else hh = 60 * (4 + (r - g) / (max - min));
  if (hh < 0) hh += 360;
  const s = max === 0 ? 0 : ((max - min) / max) * 100;
  const l = ((max + min) / 2) * 100;
  const newHue = (hh + shift) % 360;
  const a = s / 100;
  const k = (n: number) => (n + newHue / 30) % 12;
  const f = (n: number) =>
    l / 100 -
    a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)) * (l / 100) * (1 - (l / 100));
  const toHex = (v: number) =>
    Math.round(255 * Math.max(0, Math.min(1, f(v))))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

/** 字体映射 */
const FONT_FAMILY_MAP: Record<string, string> = {
  kaiti: "'KaiTi', '楷体', serif",
  songti: "'SimSun', '宋体', serif",
  heiti: "'SimHei', '黑体', sans-serif",
  fangsong: "'FangSong', '仿宋', serif",
  yahei: "'Microsoft YaHei', '微软雅黑', sans-serif",
};

/** 清除自定义主题内联样式 */
function clearCustomThemeVars() {
  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--primary-hover");
  root.style.removeProperty("--accent");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--sidebar-primary");
  root.style.removeProperty("--sidebar-ring");
  root.style.removeProperty("--chart-1");
  root.style.removeProperty("--chart-2");
  root.style.removeProperty("--chart-3");
}

/** 完整应用主题到 DOM（主题/模式变化时使用） */
function applyThemeDOM(
  theme: ThemeName,
  mode: "dark" | "light",
  customColor: string,
  fontFamily: FontOption,
  fontCustom: string,
) {
  const root = document.documentElement;

  // 决定 data-theme 属性值
  let effectiveTheme: ThemeName = theme;
  if (theme === "custom") {
    const lastPreset = localStorage.getItem(LAST_PRESET_KEY) as ThemeName | null;
    effectiveTheme = lastPreset ?? "default";
  }

  root.setAttribute("data-theme", effectiveTheme);
  root.setAttribute("data-mode", mode);
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // 清除旧的自定义内联样式
  clearCustomThemeVars();

  // 自定义主题色：以内联样式覆盖 primary/accent 等
  if (theme === "custom" && customColor) {
    const primary = hexToRgbTriple(customColor);
    const hover = hexToRgbTriple(lightenHex(customColor));
    const accent = hexToRgbTriple(accentFromHex(customColor));
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-hover", hover);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--ring", primary);
    root.style.setProperty("--sidebar-primary", primary);
    root.style.setProperty("--sidebar-ring", primary);
    root.style.setProperty("--chart-1", primary);
    root.style.setProperty("--chart-2", hover);
    root.style.setProperty("--chart-3", accent);
  }

  // 字体
  let fontValue = "";
  if (fontFamily && fontFamily !== "system" && fontFamily !== "custom") {
    fontValue = FONT_FAMILY_MAP[fontFamily] ?? "";
  } else if (fontFamily === "custom" && fontCustom) {
    fontValue = fontCustom;
  }
  if (fontValue) {
    root.style.setProperty("--font-editor", fontValue);
  } else {
    root.style.removeProperty("--font-editor");
  }
}

/** 仅更新自定义颜色（不触碰 data-theme/data-mode/.dark） */
export function applyCustomColorOnly(color: string) {
  const root = document.documentElement;
  const primary = hexToRgbTriple(color);
  const hover = hexToRgbTriple(lightenHex(color));
  const accent = hexToRgbTriple(accentFromHex(color));
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-hover", hover);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--ring", primary);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-ring", primary);
  root.style.setProperty("--chart-1", primary);
  root.style.setProperty("--chart-2", hover);
  root.style.setProperty("--chart-3", accent);
}

// ─── Context ───────────────────────────────────────────────────────────

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  mode: "dark" | "light";
  setMode: (m: "dark" | "light") => void;
  toggleMode: () => void;
  customColor: string;
  setCustomColor: (color: string) => void;
  fontFamily: FontOption;
  setFontFamily: (f: FontOption) => void;
  fontCustom: string;
  setFontCustom: (f: string) => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("default");
  const [mode, setModeState] = useState<"dark" | "light">("dark");
  const [customColor, setCustomColorState] = useState(DEFAULT_CUSTOM_COLOR);
  const [fontFamily, setFontFamilyState] = useState<FontOption>("system");
  const [fontCustom, setFontCustomState] = useState("");
  const [mounted, setMounted] = useState(false);

  // 初始化：从 localStorage 读取并应用到 DOM
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as ThemeName | null;
    const savedMode = localStorage.getItem(MODE_KEY) as "dark" | "light" | null;
    const savedColor = localStorage.getItem(COLOR_KEY) ?? DEFAULT_CUSTOM_COLOR;
    const savedFont = (localStorage.getItem(FONT_KEY) as FontOption) ?? "system";
    const savedFontCustom = localStorage.getItem(FONT_CUSTOM_KEY) ?? "";

    const t = savedTheme ?? "default";
    const m = savedMode ?? "dark";

    setThemeState(t);
    setModeState(m);
    setCustomColorState(savedColor);
    setFontFamilyState(savedFont);
    setFontCustomState(savedFontCustom);

    applyThemeDOM(t, m, savedColor, savedFont, savedFontCustom);
    setMounted(true);
  }, []);

  // 主题/模式/字体变化时同步 DOM + 持久化
  useEffect(() => {
    if (!mounted) return;
    applyThemeDOM(theme, mode, customColor, fontFamily, fontCustom);
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(MODE_KEY, mode);
    if (theme === "custom") {
      localStorage.setItem(COLOR_KEY, customColor);
    }
  }, [theme, mode, customColor, fontFamily, fontCustom, mounted]);

  const setTheme = useCallback((t: ThemeName) => {
    if (t !== "custom") {
      localStorage.setItem(LAST_PRESET_KEY, t);
    }
    setThemeState(t);
  }, []);

  const setMode = useCallback((m: "dark" | "light") => {
    setModeState(m);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const setCustomColor = useCallback((color: string) => {
    setCustomColorState(color);
    setThemeState("custom");
    // 仅同步颜色变量，不触碰 data-mode / data-theme / .dark
    // 这样无论有多少个 hook 实例在运行，修改颜色都不可能影响深浅模式
    applyCustomColorOnly(color);
  }, []);

  const setFontFamily = useCallback((f: FontOption) => {
    setFontFamilyState(f);
    localStorage.setItem(FONT_KEY, f);
  }, []);

  const setFontCustom = useCallback((f: string) => {
    setFontCustomState(f);
    localStorage.setItem(FONT_CUSTOM_KEY, f);
    setFontFamilyState("custom");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      mode,
      setMode,
      toggleMode,
      customColor,
      setCustomColor,
      fontFamily,
      setFontFamily,
      fontCustom,
      setFontCustom,
      mounted,
    }),
    [
      theme,
      setTheme,
      mode,
      setMode,
      toggleMode,
      customColor,
      setCustomColor,
      fontFamily,
      setFontFamily,
      fontCustom,
      setFontCustom,
      mounted,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
