import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { AppSidebar } from '@/components/admin/app-sidebar';
import { SiteHeader } from '@/components/admin/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { getCurrentUser } from '@/lib/api';
import { getPublicSettings } from '@/lib/settings';

/** Khu quản trị hệ thống (chỉ ADMIN), bố cục theo khối dashboard-01 của shadcn/ui. */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const [user, settings] = await Promise.all([getCurrentUser(), getPublicSettings()]);
  // Ẩn hẳn khu quản trị với người không phải admin (API cũng chặn từng route).
  if (user.systemRole !== 'ADMIN') notFound();

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" siteName={settings.siteName} user={user} />
      <SidebarInset>
        <SiteHeader colorTheme={user.theme} />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
