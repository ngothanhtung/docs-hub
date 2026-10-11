'use client';

import { InfoIcon, OctagonAlertIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  info: { icon: InfoIcon, className: 'bg-primary/10 text-foreground' },
  warning: { icon: TriangleAlertIcon, className: 'bg-amber-500/15 text-foreground' },
  danger: { icon: OctagonAlertIcon, className: 'bg-destructive/15 text-foreground' },
} as const;

const DISMISS_KEY = 'docshub:announcement-dismissed';

/** Thông báo toàn hệ thống do admin đặt. Đóng thì ẩn tới khi admin đổi nội dung thông báo. */
export function AnnouncementBar({
  message,
  tone,
  preview = false,
}: {
  message: string;
  tone: keyof typeof TONES;
  /** Xem trước trong trang cài đặt: luôn hiện, không có nút đóng. */
  preview?: boolean;
}) {
  const [hidden, setHidden] = useState(!preview);
  useEffect(() => {
    if (!preview) setHidden(localStorage.getItem(DISMISS_KEY) === message);
  }, [message, preview]);
  if (hidden) return null;
  const { icon: Icon, className } = TONES[tone] ?? TONES.info;
  return (
    <div role="status" className={cn('flex items-center gap-2 px-4 py-2 text-sm', className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">{message}</p>
      {preview ? null : (
      <button
        type="button"
        aria-label="Ẩn thông báo"
        className="rounded p-1 opacity-70 hover:opacity-100"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, message);
          setHidden(true);
        }}
      >
        <XIcon className="size-4" />
      </button>
      )}
    </div>
  );
}
