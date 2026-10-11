import type { SystemRole } from './api-types';

export const ROLE_LABEL: Record<SystemRole, string> = {
  ADMIN: 'Quản trị viên',
  INSTRUCTOR: 'Giảng viên',
  USER: 'Học viên',
};

const number = new Intl.NumberFormat('vi-VN');

export function formatNumber(value: number) {
  return number.format(value);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${number.format(Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
  return `${(bytes / 1024 ** 3).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} GB`;
}

export function formatDate(iso: string | null, withTime = false) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(
    new Date(iso),
  );
}

/** "3 phút trước", "2 ngày trước"... */
export function formatRelative(iso: string | null) {
  if (!iso) return 'Chưa bao giờ';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86_400) return rtf.format(-Math.round(diff / 3600), 'hour');
  if (diff < 30 * 86_400) return rtf.format(-Math.round(diff / 86_400), 'day');
  return formatDate(iso);
}

/** Chữ cái đầu của hai từ cuối tên, cho avatar mặc định ("Nguyễn Văn An" -> "VA"). */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
