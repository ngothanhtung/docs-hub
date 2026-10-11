/**
 * Theme giao diện, đặt tên theo bộ theme của Mintlify. Bảng màu, font, bo góc của từng theme
 * nằm ở apps/web/src/lib/themes.ts; API chỉ cần danh sách id để kiểm tra dữ liệu.
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

/** Màu chính do chủ khoá chọn: chỉ nhận #rrggbb (không nhận tên màu, rgb() hay biểu thức CSS). */
export const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
