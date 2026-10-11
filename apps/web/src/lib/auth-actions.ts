'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  apiUrl,
  clearSession,
  forwardedFor,
  REFRESH_COOKIE,
  sessionFromApiResponse,
  writeSession,
} from './session';

export interface AuthFormState {
  error?: string;
  values?: { email?: string; name?: string };
}

export async function login(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'Vui lòng nhập email và mật khẩu', values: { email } };
  return authenticate('/auth/login', { email, password }, form, { email });
}

export async function register(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!name || !email || !password) {
    return { error: 'Vui lòng nhập đủ họ tên, email và mật khẩu', values: { name, email } };
  }
  if (password.length < 8) {
    return { error: 'Mật khẩu phải có ít nhất 8 ký tự', values: { name, email } };
  }
  return authenticate('/auth/register', { name, email, password }, form, { name, email });
}

export async function logout() {
  const store = await cookies();
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    await fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE}=${refresh}` },
    }).catch(() => undefined);
  }
  clearSession(store);
  redirect('/login');
}

async function authenticate(
  path: string,
  body: Record<string, string>,
  form: FormData,
  values: AuthFormState['values'],
): Promise<AuthFormState> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...forwardedFor(await headers()) },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { error: 'Không kết nối được máy chủ, vui lòng thử lại', values };
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    return {
      error: res.status === 429 ? 'Thử quá nhiều lần, vui lòng đợi một phút' : (message ?? 'Có lỗi xảy ra'),
      values,
    };
  }

  writeSession(await cookies(), await sessionFromApiResponse(res));
  redirect(safeNext(form.get('next')));
}

/** Chỉ cho chuyển tới đường dẫn nội bộ, chặn open redirect kiểu `//evil.com`. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
