import { ArrowLeftIcon, SettingsIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CourseSettings } from '@/components/settings/course-settings';
import { CourseTheme } from '@/components/course-theme';
import { SiteHeader } from '@/components/site-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import type { Cohort, CourseMember, VersionItem } from '@/lib/api-types';
import { getStudioCourse } from '@/lib/studio';

export const metadata: Metadata = { title: 'Cài đặt khoá học' };

/** Cài đặt khoá học: thông tin, thành viên, lớp học, phiên bản. Chỉ chủ khoá. */
export default async function CourseSettingsPage({
  params,
  searchParams,
}: PageProps<'/studio/[course]/settings'>) {
  const { course: slug } = await params;
  const { tab } = await searchParams;
  const course = await getStudioCourse(slug);
  if (course.role !== 'OWNER') notFound();

  const [members, cohorts, versions] = await Promise.all([
    apiFetch<CourseMember[]>(`/courses/${course.id}/members`),
    apiFetch<Cohort[]>(`/courses/${course.id}/cohorts`),
    apiFetch<VersionItem[]>(`/courses/${course.id}/versions`),
  ]);
  const current = versions.find((v) => v.isCurrent) ?? versions[0];

  return (
    <>
      <CourseTheme theme={course.theme} primaryColor={course.primaryColor} />
      <SiteHeader>
        <Separator orientation="vertical" className="mx-2 hidden h-5 sm:block" />
        <Badge variant="secondary" className="gap-1">
          <SettingsIcon className="size-3" /> Cài đặt
        </Badge>
        <span className="hidden truncate text-sm font-medium md:block">{course.title}</span>
        <Link
          href={`/studio/${course.slug}/${current.slug}`}
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'ml-auto' })}
        >
          <ArrowLeftIcon /> <span className="hidden sm:inline">Về Studio</span>
        </Link>
      </SiteHeader>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Cài đặt khoá học</h1>
        <CourseSettings
          course={course}
          members={members}
          cohorts={cohorts}
          versions={versions}
          initialTab={typeof tab === 'string' ? tab : 'info'}
        />
      </main>
    </>
  );
}
