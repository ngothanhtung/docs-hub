import type { Metadata } from 'next';
import { CoursesTable } from '@/components/admin/courses-table';
import { PageHeading } from '@/components/admin/page-heading';
import { apiFetch } from '@/lib/api';
import type { AdminCourse } from '@/lib/api-types';

export const metadata: Metadata = { title: 'Khoá học · Quản trị' };

export default async function AdminCoursesPage() {
  const courses = await apiFetch<AdminCourse[]>('/admin/courses');
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <PageHeading
        title="Khoá học"
        description="Mọi khoá học trong hệ thống, kể cả đã lưu trữ. Chuyển chủ khoá, lưu trữ hoặc xoá vĩnh viễn."
      />
      <CoursesTable courses={courses} />
    </div>
  );
}
