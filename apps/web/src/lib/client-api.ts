'use client';

/** Lỗi trả về từ API, giữ nguyên status và body để màn hình xử lý (409 xung đột, 400 frontmatter...). */
export class ClientApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

/**
 * Gọi API từ trình duyệt qua cổng /api/v1 của web (token nằm trong cookie httpOnly).
 * Hết phiên thì chuyển về trang đăng nhập rồi quay lại đúng trang đang mở.
 */
export async function clientApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  // FormData (tải file): để trình duyệt tự đặt content-type kèm boundary.
  const isForm = init.body instanceof FormData;
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { ...(isForm ? {} : { 'content-type': 'application/json' }), ...init.headers },
  });
  if (res.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
    throw new ClientApiError(401, 'Phiên đăng nhập đã hết hạn', null);
  }
  const body = res.status === 204 ? null : ((await res.json().catch(() => null)) as Record<string, unknown> | null);
  if (res.status === 503 && body?.code === 'MAINTENANCE') {
    window.location.assign('/maintenance');
    throw new ClientApiError(503, String(body.message ?? 'Hệ thống đang bảo trì'), body);
  }
  if (!res.ok) {
    const message = body?.message;
    throw new ClientApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : res.statusText,
      body,
    );
  }
  return body as T;
}

export const jsonBody = (data: unknown): RequestInit => ({ body: JSON.stringify(data) });
