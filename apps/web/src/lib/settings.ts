import 'server-only';
import { cache } from 'react';
import { apiUrl } from './session';

/** Cấu hình công khai do admin chỉnh (Quản trị → Cài đặt). Không cần đăng nhập. */
export interface PublicSettings {
  siteName: string;
  tagline: string;
  supportEmail: string | null;
  allowSignup: boolean;
  googleLogin: boolean;
  allowedEmailDomains: string[];
  defaultTheme: string;
  defaultPrimaryColor: string | null;
  maxImageMb: number;
  importEnabled: boolean;
  announcement: { message: string; tone: 'info' | 'warning' | 'danger' } | null;
  maintenance: { message: string } | null;
}

const FALLBACK: PublicSettings = {
  siteName: 'DocsHub',
  tagline: 'Tài liệu khoá học dành cho học viên',
  supportEmail: null,
  allowSignup: true,
  googleLogin: true,
  allowedEmailDomains: [],
  defaultTheme: 'docshub',
  defaultPrimaryColor: null,
  maxImageMb: 10,
  importEnabled: true,
  announcement: null,
  maintenance: null,
};

/** Một lần mỗi request; API không phản hồi thì dùng mặc định để trang vẫn hiển thị được. */
export const getPublicSettings = cache(async (): Promise<PublicSettings> => {
  try {
    const res = await fetch(apiUrl('/settings/public'), { cache: 'no-store' });
    if (!res.ok) return FALLBACK;
    return { ...FALLBACK, ...((await res.json()) as Partial<PublicSettings>) };
  } catch {
    return FALLBACK;
  }
});
