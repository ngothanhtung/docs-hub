import type { Metadata } from 'next';
import { PageHeading } from '@/components/admin/page-heading';
import { UsersTable } from '@/components/admin/users-table';
import { apiFetch, getCurrentUser } from '@/lib/api';
import type { AdminUser } from '@/lib/api-types';

export const metadata: Metadata = { title: 'Người dùng · Quản trị' };

export default async function AdminUsersPage() {
  const [users, me] = await Promise.all([apiFetch<AdminUser[]>('/users'), getCurrentUser()]);
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeading
        title="Người dùng"
        description="Cấp quyền giảng viên, quản trị viên; khoá tài khoản (đăng xuất ngay mọi thiết bị)."
      />
      <UsersTable users={users} currentUserId={me.id} />
    </div>
  );
}
