import { ArrowLeftIcon, ChartColumnIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { CourseTheme } from '@/components/course-theme';
import { SiteHeader } from '@/components/site-header';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import type { CourseAnalytics } from '@/lib/api-types';
import { getStudioCourse } from '@/lib/studio';

export const metadata: Metadata = { title: 'Thống kê khoá học' };

const DAY_OPTIONS = ['7', '30', '90'];

/** Dashboard học tập của khoá học: ai đang học, bài nào khó, học viên tìm gì mà không thấy. Chỉ chủ khoá. */
export default async function CourseAnalyticsPage({
  params,
  searchParams,
}: PageProps<'/studio/[course]/analytics'>) {
  const { course: slug } = await params;
  const query = await searchParams;
  const course = await getStudioCourse(slug);
  if (course.role !== 'OWNER') notFound();

  const days = typeof query.days === 'string' && DAY_OPTIONS.includes(query.days) ? query.days : '30';
  const version =
    typeof query.version === 'string' && course.versions.some((v) => v.slug === query.version)
      ? query.version
      : undefined;
  const params_ = new URLSearchParams({ days, ...(version ? { version } : {}) });
  const data = await apiFetch<CourseAnalytics>(`/analytics/courses/${course.id}?${params_}`);
  const studioVersion = course.versions.find((v) => v.isCurrent) ?? course.versions[0];

  return (
    <>
      <CourseTheme theme={course.theme} primaryColor={course.primaryColor} />
      <SiteHeader>
        <Separator orientation="vertical" className="mx-2 hidden h-5 sm:block" />
        <Badge variant="secondary" className="gap-1">
          <ChartColumnIcon className="size-3" /> Thống kê
        </Badge>
        <span className="hidden truncate text-sm font-medium md:block">{course.title}</span>
        {studioVersion ? (
          <Link
            href={`/studio/${course.slug}/${studioVersion.slug}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'ml-auto' })}
          >
            <ArrowLeftIcon /> <span className="hidden sm:inline">Về Studio</span>
          </Link>
        ) : null}
      </SiteHeader>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <AnalyticsDashboard
          data={data}
          courseSlug={course.slug}
          versions={course.versions.map((v) => ({ slug: v.slug, label: v.label }))}
        />
      </main>
    </>
  );
}
