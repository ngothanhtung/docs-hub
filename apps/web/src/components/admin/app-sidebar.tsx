'use client';

import {
  BookOpenIcon,
  HistoryIcon,
  HouseIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  ServerIcon,
  Settings2Icon,
  ShieldIcon,
  UsersIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type * as React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { User } from '@/lib/api-types';
import { NavUser } from './nav-user';

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

export const ADMIN_NAV: NavItem[] = [
  { title: 'Tổng quan', url: '/admin', icon: LayoutDashboardIcon },
  { title: 'Người dùng', url: '/admin/users', icon: UsersIcon },
  { title: 'Khoá học', url: '/admin/courses', icon: BookOpenIcon },
  { title: 'Cài đặt', url: '/admin/settings', icon: Settings2Icon },
  { title: 'Hệ thống', url: '/admin/system', icon: ServerIcon },
  { title: 'Nhật ký', url: '/admin/audit', icon: HistoryIcon },
];

const SECONDARY_NAV: NavItem[] = [{ title: 'Về trang học', url: '/', icon: HouseIcon }];

function isActive(pathname: string, url: string) {
  return url === '/admin' ? pathname === '/admin' : pathname === url || pathname.startsWith(`${url}/`);
}

/** Sidebar trang quản trị, bố cục theo khối dashboard-01 của shadcn/ui. */
export function AppSidebar({
  siteName,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & { siteName: string; user: User }) {
  const pathname = usePathname();
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="data-[slot=sidebar-menu-button]:p-1.5!" render={<Link href="/admin" />}>
              <ShieldIcon className="size-5!" />
              <span className="flex flex-col leading-tight">
                <span className="truncate text-base font-semibold">{siteName}</span>
                <span className="text-xs text-muted-foreground">Quản trị hệ thống</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Quản trị</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={isActive(pathname, item.url)}
                    render={<Link href={item.url} />}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {SECONDARY_NAV.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton size="sm" render={<Link href={item.url} />}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
