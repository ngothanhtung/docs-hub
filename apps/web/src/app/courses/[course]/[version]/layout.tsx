import 'katex/dist/katex.min.css';
import { PenLineIcon } from 'lucide-react';
import Link from 'next/link';
import { MobileNav } from '@/components/reader/mobile-nav';
import { SearchDialog } from '@/components/reader/search-dialog';
import { SidebarNav } from '@/components/reader/sidebar-nav';
import { VersionSwitcher } from '@/components/reader/version-switcher';
import { CourseTheme } from '@/components/course-theme';
import { SiteHeader } from '@/components/site-header';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { apiFetch } from '@/lib/api';
import type { CourseProgress } from '@/lib/api-types';
import { getReaderTree, readerHref } from '@/lib/reader';

/** Khung trang đọc 3 cột kiểu Docusaurus: sidebar | nội dung | mục lục trang. */
export default async function ReaderLayout({
  params,
  children,
}: LayoutProps<'/courses/[course]/[version]'>) {
  const { course: courseSlug, version: versionSlug } = await params;
  const { course, version, versions, role, tree } = await getReaderTree(courseSlug, versionSlug);
  const basePath = readerHref(course.slug, version.slug);
  const progress = await apiFetch<CourseProgress>(
    `/me/progress?course=${encodeURIComponent(course.slug)}&version=${encodeURIComponent(version.slug)}`,
  );
  const nav = { tree, basePath, completed: progress.completedDocIds, progress };

  return (
    <>
      <CourseTheme theme={course.theme} primaryColor={course.primaryColor} />
      <SiteHeader start={<MobileNav {...nav} courseTitle={course.title} />}>
        <Separator orientation="vertical" className="mx-2 hidden h-5 sm:block" />
        <Link href={basePath} className="hidden truncate text-sm font-medium sm:block">
          {course.title}
        </Link>
        <VersionSwitcher courseSlug={course.slug} current={version.slug} versions={versions} />
        <div className="ml-auto flex min-w-0 flex-1 justify-end">
          <SearchDialog courseSlug={course.slug} versionSlug={version.slug} />
        </div>
        {role !== 'LEARNER' ? (
          <Link
            href={`/studio/${course.slug}/${version.slug}`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <PenLineIcon /> <span className="hidden sm:inline">Soạn bài</span>
          </Link>
        ) : null}
      </SiteHeader>
      <div className="mx-auto flex w-full max-w-[90rem] flex-1">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-72 shrink-0 overflow-y-auto border-r px-3 py-6 lg:block">
          <SidebarNav {...nav} />
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
