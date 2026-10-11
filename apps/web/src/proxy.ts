import { type NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  apiUrl,
  clearSession,
  forwardedFor,
  REFRESH_COOKIE,
  type Session,
  sessionFromApiResponse,
  tokenExpiresAt,
  writeSession,
} from './lib/session';

/** Trang không cần đăng nhập. Đã đăng nhập mà vào đây thì quay về trang chủ. */
const GUEST_PATHS = ['/login', '/register'];

/** Trang ai cũng xem được, có đăng nhập hay không (thông báo bảo trì). */
const OPEN_PATHS = ['/maintenance'];

/** Refresh sớm khi access token còn dưới 60 giây. */
const REFRESH_MARGIN_MS = 60_000;

/**
 * Nhiều request song song (prefetch link) cùng mang một refresh token cũ: chỉ refresh một lần
 * và dùng chung kết quả trong 30 giây, tránh API coi đó là token bị dùng lại.
 */
const refreshes = new Map<string, { promise: Promise<Session | null>; at: number }>();
const SHARE_REFRESH_MS = 30_000;

/**
 * Kiểm tra lạc quan trước mỗi request: còn access token hợp lệ thì cho qua,
 * sắp hết hạn thì đổi refresh token lấy token mới, không có phiên thì về /login.
 * Quyền truy cập thật sự vẫn do API kiểm tra.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (OPEN_PATHS.includes(pathname)) return NextResponse.next();
  const isGuestPage = GUEST_PATHS.includes(pathname);
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  const accessValid =
    access !== undefined && (tokenExpiresAt(access) ?? 0) - Date.now() > REFRESH_MARGIN_MS;
  if (accessValid) {
    return isGuestPage ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }

  const session = refresh ? await refreshOnce(refresh, request.headers) : null;
  if (session) {
    if (isGuestPage) {
      const response = NextResponse.redirect(new URL('/', request.url));
      writeSession(response.cookies, session);
      return response;
    }
    // Ghi token mới vào cả request (để Server Component đọc ngay) lẫn response (để trình duyệt lưu).
    request.cookies.set(ACCESS_COOKIE, session.accessToken);
    request.cookies.set(REFRESH_COOKIE, session.refreshToken);
    const response = NextResponse.next({ request: { headers: request.headers } });
    writeSession(response.cookies, session);
    return response;
  }

  if (isGuestPage) return NextResponse.next();

  const response = pathname.startsWith('/api/')
    ? NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 })
    : NextResponse.redirect(loginUrl(request, pathname + search));
  clearSession(response.cookies);
  return response;
}

function loginUrl(request: NextRequest, next: string) {
  const url = new URL('/login', request.url);
  if (next !== '/') url.searchParams.set('next', next);
  return url;
}

function refreshOnce(refreshToken: string, headers: Headers): Promise<Session | null> {
  const now = Date.now();
  for (const [key, entry] of refreshes) {
    if (now - entry.at > SHARE_REFRESH_MS) refreshes.delete(key);
  }
  const existing = refreshes.get(refreshToken);
  if (existing) return existing.promise;

  const promise = fetch(apiUrl('/auth/refresh'), {
    method: 'POST',
    headers: { cookie: `${REFRESH_COOKIE}=${refreshToken}`, ...forwardedFor(headers) },
    cache: 'no-store',
  })
    .then((res) => (res.ok ? sessionFromApiResponse(res) : null))
    .catch(() => null);
  refreshes.set(refreshToken, { promise, at: now });
  return promise;
}

export const config = {
  // Bỏ qua file tĩnh và ảnh tối ưu của Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
