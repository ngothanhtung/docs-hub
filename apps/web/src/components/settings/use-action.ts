'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { ClientApiError } from '@/lib/client-api';

/**
 * Chạy một thao tác gọi API: báo thành công/lỗi bằng toast rồi tải lại dữ liệu trang (router.refresh).
 * `pending` = id của thao tác đang chạy, để khoá đúng nút đó.
 */
export function useAction() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const run = async <T,>(
    key: string,
    action: () => Promise<T>,
    success: string | ((result: T) => string),
  ) => {
    setPending(key);
    try {
      const result = await action();
      toast.success(typeof success === 'function' ? success(result) : success);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Có lỗi xảy ra');
      return false;
    } finally {
      setPending(null);
    }
  };

  return { run, pending, refresh: () => router.refresh() };
}

export const formatDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(iso)) : '—';
