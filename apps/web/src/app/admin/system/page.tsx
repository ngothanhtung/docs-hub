import type { Metadata } from 'next';
import { PageHeading } from '@/components/admin/page-heading';
import { SystemStatusView } from '@/components/admin/system-status';
import { apiFetch } from '@/lib/api';
import type { SystemStatus } from '@/lib/api-types';

export const metadata: Metadata = { title: 'Hệ thống · Quản trị' };

export default async function AdminSystemPage() {
  const status = await apiFetch<SystemStatus>('/admin/system');
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeading title="Hệ thống" description="Tình trạng các dịch vụ DocsHub phụ thuộc và công cụ bảo trì." />
      <SystemStatusView status={status} />
    </div>
  );
}
