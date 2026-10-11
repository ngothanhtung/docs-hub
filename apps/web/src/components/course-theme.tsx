import { courseThemeCss } from '@/lib/themes';

/**
 * Theme và màu chính do chủ khoá chọn. CSS chỉ áp khi người dùng chưa tự chọn theme
 * (`<html>` không có data-theme), và tự mất khi rời các trang của khoá học.
 * Giá trị đã được kiểm tra (id trong danh sách, màu #rrggbb) trước khi đưa vào CSS.
 */
export function CourseTheme({ theme, primaryColor }: { theme: string | null; primaryColor: string | null }) {
  const css = courseThemeCss(theme, primaryColor);
  if (!css) return null;
  return <style data-course-theme="" dangerouslySetInnerHTML={{ __html: css }} />;
}
