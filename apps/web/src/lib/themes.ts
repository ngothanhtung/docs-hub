/**
 * Theme giao diện, đặt tên theo bộ theme của Mintlify (mint, maple, palm...). Mỗi theme đổi
 * bảng màu sáng/tối, font và độ bo góc; bố cục trang giữ nguyên. Màu là của DocsHub, chỉ lấy
 * cảm hứng từ tinh thần từng theme, không sao chép Mintlify.
 *
 * Danh sách id phải khớp THEME_IDS ở apps/api/src/common/themes.ts.
 */

export const THEME_IDS = [
  'docshub',
  'mint',
  'maple',
  'palm',
  'willow',
  'linden',
  'almond',
  'aspen',
  'sequoia',
  'luma',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

/** Biến font do next/font tạo trong app/layout.tsx. */
export type FontVar =
  | '--font-inter'
  | '--font-jakarta'
  | '--font-plex-sans'
  | '--font-plex-mono'
  | '--font-geist'
  | '--font-nunito'
  | '--font-manrope'
  | '--font-lora'
  | '--font-lexend';

interface Palette {
  primary: string;
  primaryForeground: string;
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  /** Sắc độ (hue) và độ đậm (chroma) của các màu nền/viền trung tính. */
  neutral: { hue: number; chroma: number };
  light: Palette;
  dark: Palette;
  radius: string;
  font: FontVar;
  headingFont: FontVar;
  /** Tên font để hiện trong phần chọn theme. */
  fontLabel: string;
}

const WHITE = 'oklch(0.985 0 0)';

export const THEMES: Record<ThemeId, ThemeDef> = {
  docshub: {
    id: 'docshub',
    name: 'DocsHub',
    description: 'Mặc định: trung tính, xanh dương, dễ đọc lâu.',
    neutral: { hue: 0, chroma: 0 },
    light: { primary: 'oklch(0.546 0.215 262.9)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.707 0.165 254.6)', primaryForeground: 'oklch(0.205 0 0)' },
    radius: '0.625rem',
    font: '--font-inter',
    headingFont: '--font-inter',
    fontLabel: 'Inter',
  },
  mint: {
    id: 'mint',
    name: 'Mint',
    description: 'Cổ điển kiểu tài liệu Mintlify, xanh bạc hà.',
    neutral: { hue: 170, chroma: 0.006 },
    light: { primary: 'oklch(0.52 0.12 170)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.78 0.13 170)', primaryForeground: 'oklch(0.2 0.03 170)' },
    radius: '0.75rem',
    font: '--font-inter',
    headingFont: '--font-inter',
    fontLabel: 'Inter',
  },
  maple: {
    id: 'maple',
    name: 'Maple',
    description: 'Hiện đại, gọn gàng, hợp sản phẩm AI và SaaS; tím.',
    neutral: { hue: 285, chroma: 0.008 },
    light: { primary: 'oklch(0.52 0.21 285)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.76 0.13 285)', primaryForeground: 'oklch(0.2 0.04 285)' },
    radius: '0.875rem',
    font: '--font-jakarta',
    headingFont: '--font-jakarta',
    fontLabel: 'Plus Jakarta Sans',
  },
  palm: {
    id: 'palm',
    name: 'Palm',
    description: 'Trang nhã kiểu fintech: xanh navy, góc vuông vắn.',
    neutral: { hue: 250, chroma: 0.012 },
    light: { primary: 'oklch(0.45 0.15 258)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.76 0.11 250)', primaryForeground: 'oklch(0.2 0.04 255)' },
    radius: '0.375rem',
    font: '--font-plex-sans',
    headingFont: '--font-plex-sans',
    fontLabel: 'IBM Plex Sans',
  },
  willow: {
    id: 'willow',
    name: 'Willow',
    description: 'Tối giản đen trắng, không có gì làm phân tâm.',
    neutral: { hue: 0, chroma: 0 },
    light: { primary: 'oklch(0.24 0 0)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.93 0 0)', primaryForeground: 'oklch(0.2 0 0)' },
    radius: '0.25rem',
    font: '--font-geist',
    headingFont: '--font-geist',
    fontLabel: 'Geist',
  },
  linden: {
    id: 'linden',
    name: 'Linden',
    description: 'Cổ điển tối giản: nền giấy ấm, tiêu đề chữ máy, góc vuông.',
    neutral: { hue: 80, chroma: 0.014 },
    light: { primary: 'oklch(0.5 0.13 45)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.77 0.11 60)', primaryForeground: 'oklch(0.2 0.03 60)' },
    radius: '0rem',
    font: '--font-plex-sans',
    headingFont: '--font-plex-mono',
    fontLabel: 'IBM Plex Sans + Mono',
  },
  almond: {
    id: 'almond',
    name: 'Almond',
    description: 'Ấm áp, mềm mại: nền kem, màu san hô, bo tròn.',
    neutral: { hue: 60, chroma: 0.012 },
    light: { primary: 'oklch(0.55 0.16 28)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.77 0.12 35)', primaryForeground: 'oklch(0.2 0.04 35)' },
    radius: '1rem',
    font: '--font-nunito',
    headingFont: '--font-nunito',
    fontLabel: 'Nunito',
  },
  aspen: {
    id: 'aspen',
    name: 'Aspen',
    description: 'Sắc nét, mát mắt: xanh lam ngọc.',
    neutral: { hue: 220, chroma: 0.008 },
    light: { primary: 'oklch(0.5 0.1 220)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.79 0.1 215)', primaryForeground: 'oklch(0.2 0.03 220)' },
    radius: '0.5rem',
    font: '--font-manrope',
    headingFont: '--font-manrope',
    fontLabel: 'Manrope',
  },
  sequoia: {
    id: 'sequoia',
    name: 'Sequoia',
    description: 'Rừng sâu: xanh lá thẫm, tiêu đề chữ có chân.',
    neutral: { hue: 140, chroma: 0.01 },
    light: { primary: 'oklch(0.46 0.1 150)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.78 0.12 150)', primaryForeground: 'oklch(0.2 0.03 150)' },
    radius: '0.5rem',
    font: '--font-inter',
    headingFont: '--font-lora',
    fontLabel: 'Inter + Lora',
  },
  luma: {
    id: 'luma',
    name: 'Luma',
    description: 'Tươi sáng, trẻ trung: hồng tím, bo tròn.',
    neutral: { hue: 320, chroma: 0.006 },
    light: { primary: 'oklch(0.53 0.2 340)', primaryForeground: WHITE },
    dark: { primary: 'oklch(0.77 0.14 345)', primaryForeground: 'oklch(0.2 0.05 345)' },
    radius: '1rem',
    font: '--font-lexend',
    headingFont: '--font-lexend',
    fontLabel: 'Lexend',
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_RE.test(value);
}

type Vars = Record<string, string>;

/** Giá trị gốc trong globals.css, để DocsHub cũng là một theme chọn được (đè theme mặc định hệ thống). */
const DOCSHUB_VARS: Record<'light' | 'dark', Vars> = {
  light: {
    '--background': 'oklch(1 0 0)',
    '--foreground': 'oklch(0.145 0 0)',
    '--card': 'oklch(1 0 0)',
    '--card-foreground': 'oklch(0.145 0 0)',
    '--popover': 'oklch(1 0 0)',
    '--popover-foreground': 'oklch(0.145 0 0)',
    '--secondary': 'oklch(0.97 0 0)',
    '--secondary-foreground': 'oklch(0.205 0 0)',
    '--muted': 'oklch(0.97 0 0)',
    '--muted-foreground': 'oklch(0.556 0 0)',
    '--accent': 'oklch(0.97 0 0)',
    '--accent-foreground': 'oklch(0.205 0 0)',
    '--border': 'oklch(0.922 0 0)',
    '--input': 'oklch(0.922 0 0)',
    '--ring': 'oklch(0.623 0.188 259.8)',
  },
  dark: {
    '--background': 'oklch(0.145 0 0)',
    '--foreground': 'oklch(0.985 0 0)',
    '--card': 'oklch(0.205 0 0)',
    '--card-foreground': 'oklch(0.985 0 0)',
    '--popover': 'oklch(0.205 0 0)',
    '--popover-foreground': 'oklch(0.985 0 0)',
    '--secondary': 'oklch(0.269 0 0)',
    '--secondary-foreground': 'oklch(0.985 0 0)',
    '--muted': 'oklch(0.269 0 0)',
    '--muted-foreground': 'oklch(0.708 0 0)',
    '--accent': 'oklch(0.269 0 0)',
    '--accent-foreground': 'oklch(0.985 0 0)',
    '--border': 'oklch(1 0 0 / 10%)',
    '--input': 'oklch(1 0 0 / 15%)',
    '--ring': 'oklch(0.623 0.188 259.8)',
  },
};

/** Các biến màu của một theme ở một chế độ. */
function paletteVars(theme: ThemeDef, mode: 'light' | 'dark'): Vars {
  if (theme.id === 'docshub') {
    const p = theme[mode];
    return { ...DOCSHUB_VARS[mode], '--primary': p.primary, '--primary-foreground': p.primaryForeground };
  }
  const { hue: h, chroma: c } = theme.neutral;
  const p = theme[mode];
  const n = (l: number, chroma = c, alpha?: number) =>
    `oklch(${l} ${chroma.toFixed(3)} ${h}${alpha === undefined ? '' : ` / ${alpha}%`})`;
  const base =
    mode === 'light'
      ? {
          '--background': n(0.995, c * 0.4),
          '--foreground': n(0.16),
          '--card': n(0.998, c * 0.3),
          '--card-foreground': n(0.16),
          '--popover': n(0.998, c * 0.3),
          '--popover-foreground': n(0.16),
          '--secondary': n(0.965),
          '--secondary-foreground': n(0.22),
          '--muted': n(0.965),
          '--muted-foreground': n(0.5),
          '--accent': n(0.955),
          '--accent-foreground': n(0.22),
          '--border': n(0.91),
          '--input': n(0.91),
        }
      : {
          '--background': n(0.155),
          '--foreground': n(0.97, c * 0.4),
          '--card': n(0.2),
          '--card-foreground': n(0.97, c * 0.4),
          '--popover': n(0.2),
          '--popover-foreground': n(0.97, c * 0.4),
          '--secondary': n(0.26),
          '--secondary-foreground': n(0.97, c * 0.4),
          '--muted': n(0.26),
          '--muted-foreground': n(0.72),
          '--accent': n(0.27),
          '--accent-foreground': n(0.97, c * 0.4),
          '--border': n(1, 0, 10),
          '--input': n(1, 0, 15),
        };
  return { ...base, '--primary': p.primary, '--primary-foreground': p.primaryForeground, '--ring': p.primary };
}

/** Biến chung cho cả sáng/tối: bo góc và font. */
function shapeVars(theme: ThemeDef): Vars {
  return {
    '--radius': theme.radius,
    '--font-sans': `var(${theme.font})`,
    '--theme-font-heading': `var(${theme.headingFont})`,
  };
}

/**
 * Màu chính riêng của khoá (#rrggbb). Chỉnh độ sáng để chữ trên nền và chữ trắng trên nút
 * luôn đủ tương phản (WCAG AA): chế độ sáng tối đi nếu quá sáng, chế độ tối sáng lên nếu quá tối.
 */
export function primaryOverride(hex: string): { light: Vars; dark: Vars } {
  const [l, c, h] = hexToOklch(hex);
  // Xanh lá/vàng chói nằm ngoài gam màu khi tối đi: giới hạn cả độ đậm để trình duyệt không đẩy màu sáng lên lại.
  const light = `oklch(${Math.min(l, 0.52).toFixed(3)} ${Math.min(c, 0.17).toFixed(3)} ${h.toFixed(1)})`;
  const dark = `oklch(${Math.max(l, 0.76).toFixed(3)} ${Math.min(c, 0.16).toFixed(3)} ${h.toFixed(1)})`;
  return {
    light: { '--primary': light, '--primary-foreground': WHITE, '--ring': light },
    dark: { '--primary': dark, '--primary-foreground': `oklch(0.2 0.03 ${h.toFixed(1)})`, '--ring': dark },
  };
}

function block(selector: string, vars: Vars): string {
  const body = Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
  return body ? `${selector}{${body}}` : '';
}

/** CSS của một theme (và màu chính riêng nếu có) cho cặp selector sáng/tối. */
export function themeCss(
  selectors: { light: string; dark: string },
  themeId: ThemeId,
  primaryColor?: string | null,
): string {
  const theme = THEMES[themeId];
  const custom = isHexColor(primaryColor) ? primaryOverride(primaryColor) : null;
  const light = { ...paletteVars(theme, 'light'), ...shapeVars(theme), ...custom?.light };
  const dark = { ...paletteVars(theme, 'dark'), ...custom?.dark };
  return block(selectors.light, light) + block(selectors.dark, dark);
}

/** CSS cho theme người dùng tự chọn: `<html data-theme="maple">`. */
export function userThemesCss(): string {
  return THEME_IDS.map((id) =>
    themeCss({ light: `html[data-theme="${id}"]`, dark: `html.dark[data-theme="${id}"]` }, id),
  ).join('');
}

const UNTHEMED = { light: 'html:not([data-theme])', dark: 'html.dark:not([data-theme])' };

/** Chỉ đè màu chính, giữ nguyên theme đang áp. */
function primaryOnlyCss(primaryColor: string): string {
  const custom = primaryOverride(primaryColor);
  return block(UNTHEMED.light, custom.light) + block(UNTHEMED.dark, custom.dark);
}

/**
 * Theme mặc định toàn hệ thống (admin chọn). Đặt trong <head>; theme của khoá học (thẻ <style>
 * nằm sau trong <body>, cùng độ ưu tiên) và theme người dùng tự chọn (data-theme) đều đè được.
 */
export function systemThemeCss(theme: string | null | undefined, primaryColor: string | null | undefined): string {
  const id = isThemeId(theme) ? theme : 'docshub';
  if (id === 'docshub') return isHexColor(primaryColor) ? primaryOnlyCss(primaryColor) : '';
  return themeCss(UNTHEMED, id, primaryColor);
}

/**
 * CSS cho theme của khoá học: chỉ áp khi người dùng chưa tự chọn theme
 * (`<html>` không có data-theme). `theme` null = theo mặc định hệ thống.
 * Dùng ở layout trang đọc, Studio, cài đặt khoá.
 */
export function courseThemeCss(theme: string | null | undefined, primaryColor: string | null | undefined): string {
  if (!isThemeId(theme)) return isHexColor(primaryColor) ? primaryOnlyCss(primaryColor) : '';
  return themeCss(UNTHEMED, theme, primaryColor);
}

/** Biến CSS để xem trước theme trong một khung nhỏ (phần chọn theme). */
export function previewVars(themeId: ThemeId, mode: 'light' | 'dark', primaryColor?: string | null): Vars {
  const theme = THEMES[themeId];
  const custom = isHexColor(primaryColor) ? primaryOverride(primaryColor)[mode] : {};
  return { ...paletteVars(theme, mode), ...shapeVars(theme), ...custom };
}

// ---------- màu ----------

/** #rrggbb -> [L, C, h] trong không gian OKLCH. */
export function hexToOklch(hex: string): [number, number, number] {
  const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(Number.parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.sqrt(A * A + B * B);
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}
