'use client';

import type { MouseEvent } from 'react';
import { toast } from 'sonner';

/**
 * Bấm link trong khung preview của Studio: link sang trang đọc mở ở tab mới (không rời editor),
 * link nội bộ chưa trỏ tới bài nào thì chặn lại thay vì nhảy tới một URL sai trong Studio.
 */
export function handlePreviewLinkClick(event: MouseEvent<HTMLElement>) {
  const anchor = (event.target as HTMLElement).closest('a');
  const href = anchor?.getAttribute('href');
  if (!href || href.startsWith('#') || /^https?:\/\//i.test(href)) return;
  event.preventDefault();
  if (href.startsWith('/courses/')) {
    window.open(href, '_blank', 'noopener');
  } else {
    toast.info(`Link "${href}" chưa trỏ tới bài nào trong phiên bản này`);
  }
}
