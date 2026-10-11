import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { CourseProgress } from '@/lib/api-types';
import { firstDocPath, getReaderTree, readerHref } from '@/lib/reader';

/**
 * /courses/nestjs -> bài đang đọc dở (nếu có), không thì bài đầu tiên
 * của version mặc định (version của lớp hoặc version hiện hành).
 */
export default async function CoursePage({ params }: PageProps<'/courses/[course]'>) {
  const { course } = await params;
  const { version, tree } = await getReaderTree(course);
  const progress = await apiFetch<CourseProgress>(
    `/me/progress?course=${encodeURIComponent(course)}&version=${encodeURIComponent(version.slug)}`,
  );
  redirect(readerHref(course, version.slug, progress.lastDoc?.path ?? firstDocPath(tree) ?? ''));
}
