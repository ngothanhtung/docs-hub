import 'server-only';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import type { User } from './api-types';
import { ACCESS_COOKIE, apiUrl, forwardedFor } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
  }
}

/**
 * Gọi NestJS từ Server Component / Server Action với access token trong cookie.
 * proxy.ts đã refresh token trước khi request tới đây, nên 401 nghĩa là phiên đã bị thu hồi.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(apiUrl(path), {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      ...forwardedFor(await headers()),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401) redirect('/login');
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  // Admin bật chế độ bảo trì: API trả 503 cho mọi người trừ admin.
  if (res.status === 503 && (body as { code?: string } | null)?.code === 'MAINTENANCE') redirect('/maintenance');
  if (!res.ok) {
    const message = (body as { message?: string | string[] } | null)?.message;
    throw new ApiError(
      res.status,
      Array.isArray(message) ? message.join(', ') : (message ?? res.statusText),
      body,
    );
  }
  return body as T;
}

/** Như apiFetch nhưng 404/403 thì hiện trang "Không tìm thấy". */
export async function apiFetchOrNotFound<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await apiFetch<T>(path, init);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) notFound();
    throw error;
  }
}

/** Người dùng hiện tại, gọi API một lần cho mỗi request dù nhiều component cần. */
export const getCurrentUser = cache(() => apiFetch<User>('/auth/me'));
