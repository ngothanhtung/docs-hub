import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { ACCESS_COOKIE, apiUrl, forwardedFor } from '@/lib/session';

/**
 * Cổng cho Client Component gọi API (Studio, autosave...): gắn access token từ cookie
 * httpOnly rồi chuyển tiếp sang NestJS. Route đăng nhập không đi qua đây.
 */
async function forward(request: NextRequest, { params }: RouteContext<'/api/v1/[...path]'>) {
  const { path } = await params;
  if (path[0] === 'auth') {
    return Response.json({ message: 'Không hỗ trợ' }, { status: 404 });
  }

  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const target = apiUrl(`/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`);
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const res = await fetch(target, {
    method: request.method,
    headers: {
      ...(request.headers.get('content-type')
        ? { 'content-type': request.headers.get('content-type')! }
        : {}),
      ...forwardedFor(request.headers),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: hasBody ? await request.arrayBuffer() : undefined,
    cache: 'no-store',
    // Ảnh: API trả 302 tới URL S3 đã ký; chuyển nguyên redirect cho trình duyệt tải thẳng từ S3.
    redirect: 'manual',
  });

  // Chỉ chuyển các header cần thiết; không chuyển Set-Cookie hay header nội bộ của API.
  const responseHeaders = new Headers();
  for (const name of ['content-type', 'cache-control', 'location']) {
    const value = res.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  if (res.status >= 300 && res.status < 400) {
    return new Response(null, { status: res.status, headers: responseHeaders });
  }
  return new Response(res.status === 204 ? null : res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
