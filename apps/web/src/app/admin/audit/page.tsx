import type { Metadata } from 'next';
import { AuditLog } from '@/components/admin/audit-log';
import { PageHeading } from '@/components/admin/page-heading';
import { apiFetch } from '@/lib/api';
import type { AuditEntry } from '@/lib/api-types';

export const metadata: Metadata = { title: 'Nhật ký · Quản trị' };

export default async function AdminAuditPage({ searchParams }: PageProps<'/admin/audit'>) {
  const { action } = await searchParams;
  const filter = typeof action === 'string' && /^[a-z.]{1,40}$/.test(action) ? action : '';
  const entries = await apiFetch<AuditEntry[]>(`/admin/audit?limit=100${filter ? `&action=${filter}` : ''}`);
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeading
        title="Nhật ký quản trị"
        description="Ai đã đổi cấu hình, vai trò, khoá tài khoản, lưu trữ hay xoá khoá học, và khi nào."
      />
      <AuditLog key={filter} entries={entries} action={filter} />
    </div>
  );
}
