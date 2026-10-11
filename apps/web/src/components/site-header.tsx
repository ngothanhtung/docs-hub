import { BookOpenTextIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { getCurrentUser } from '@/lib/api';
import { getPublicSettings } from '@/lib/settings';
import { AnnouncementBar } from './announcement-bar';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';

/** Thanh trên cùng. `start` dành cho nút mở sidebar (mobile) và tên khoá học ở trang đọc. */
export async function SiteHeader({ start, children }: { start?: ReactNode; children?: ReactNode }) {
  const [user, settings] = await Promise.all([getCurrentUser(), getPublicSettings()]);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      {settings.announcement ? (
        <AnnouncementBar message={settings.announcement.message} tone={settings.announcement.tone} />
      ) : null}
      <div className="flex h-14 items-center gap-2 px-4">
        {start}
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <BookOpenTextIcon className="size-5 text-primary" />
          <span>{settings.siteName}</span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
        <ThemeToggle colorTheme={user.theme} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
