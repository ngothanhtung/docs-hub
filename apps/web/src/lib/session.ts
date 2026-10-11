/**
 * Phiên đăng nhập kiểu backend-for-frontend: Next.js giữ access token và refresh token
 * trong cookie httpOnly của chính web, rồi gọi NestJS từ phía server.
 * File này không phụ thuộc next/headers để dùng được cả trong proxy.ts lẫn Server Action.
 */

export const ACCESS_COOKIE = 'docshub_at';
export const REFRESH_COOKIE = 'docshub_rt';
/** Theme người dùng tự chọn (không bí mật, JavaScript đọc được để đổi ngay không cần tải lại). */
export const THEME_COOKIE = 'docshub_theme';

export interface Session {
  accessToken: string;
  /** Số giây access token còn hiệu lực. */
  expiresIn: number;
  refreshToken: string;
  refreshExpires: Date;
  /** Theme đã lưu trong tài khoản; `undefined` = response không có thông tin user (refresh). */
  theme?: string | null;
}

export interface CookieWriter {
  set(
    name: string,
    value: string,
    options: {
      httpOnly: boolean;
      secure: boolean;
      sameSite: 'lax';
      path: string;
      maxAge?: number;
      expires?: Date;
    },
  ): unknown;
  delete(name: string): unknown;
}

export function apiUrl(path: string): string {
  const base = process.env.API_URL;
  if (!base) throw new Error('Thiếu biến môi trường API_URL');
  return `${base.replace(/\/$/, '')}${path}`;
}

const secure = process.env.NODE_ENV === 'production';

export function writeSession(cookies: CookieWriter, session: Session) {
  cookies.set(ACCESS_COOKIE, session.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: session.expiresIn,
  });
  cookies.set(REFRESH_COOKIE, session.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    expires: session.refreshExpires,
  });
  // Đăng nhập ở máy mới: lấy lại theme đã chọn trong tài khoản.
  if (session.theme) {
    cookies.set(THEME_COOKIE, session.theme, { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 60 * 60 });
  } else if (session.theme === null) {
    cookies.delete(THEME_COOKIE);
  }
}

export function clearSession(cookies: CookieWriter) {
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
}

/**
 * Đọc phản hồi đăng nhập/refresh của API: access token nằm trong body,
 * refresh token nằm trong Set-Cookie `docshub_rt` mà API gửi về.
 */
export async function sessionFromApiResponse(res: Response): Promise<Session> {
  const body = (await res.json()) as { accessToken: string; expiresIn: number; user?: { theme?: string | null } };
  const setCookie = res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  if (!setCookie) throw new Error('API không trả refresh token');

  const [pair, ...attributes] = setCookie.split(';');
  const refreshToken = decodeURIComponent(pair.slice(REFRESH_COOKIE.length + 1));
  const expiresAttr = attributes
    .map((a) => a.trim())
    .find((a) => a.toLowerCase().startsWith('expires='));
  const refreshExpires = expiresAttr
    ? new Date(expiresAttr.slice('expires='.length))
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return {
    accessToken: body.accessToken,
    expiresIn: body.expiresIn,
    refreshToken,
    refreshExpires,
    theme: body.user ? (body.user.theme ?? null) : undefined,
  };
}

/** Đọc `exp` của JWT (không kiểm chữ ký, việc đó do API làm) để biết khi nào cần refresh. */
export function tokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Header chuyển tiếp IP thật của người dùng để API giới hạn tần suất theo từng người. */
export function forwardedFor(headers: Headers): Record<string, string> {
  const ip = headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip');
  return ip ? { 'x-forwarded-for': ip } : {};
}
