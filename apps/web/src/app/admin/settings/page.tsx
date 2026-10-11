import type { Metadata } from 'next';
import { PageHeading } from '@/components/admin/page-heading';
import { SettingsForm } from '@/components/admin/settings-form';
import { apiFetch } from '@/lib/api';
import type { AdminSettings } from '@/lib/api-types';

export const metadata: Metadata = { title: 'Cài đặt · Quản trị' };

export default async function AdminSettingsPage() {
  const data = await apiFetch<AdminSettings>('/admin/settings');
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeading
        title="Cài đặt hệ thống"
        description="Áp ngay cho mọi người dùng (API đọc lại cấu hình trong tối đa 30 giây nếu chạy nhiều máy chủ)."
      />
      <SettingsForm data={data} />
    </div>
  );
}
