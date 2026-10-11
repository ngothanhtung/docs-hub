import 'katex/dist/katex.min.css';
import { BookOpenIcon, ChartColumnIcon, PenLineIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { CourseTheme } from '@/components/course-theme';
import { SiteHeader } from '@/components/site-header';
import { StudioTree } from '@/components/studio/studio-tree';
import { StudioVersionSwitcher } from '@/components/studio/studio-version-switcher';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { readerHref } from '@/lib/reader';
import { getStudioContext } from '@/lib/studio';

export default async function StudioLayout({
  params,
  children,
}: LayoutProps<'/studio/[course]/[version]'>) {
  const { course: courseSlug, version: versionSlug } = await params;
  const { course, version, tree } = await getStudioContext(courseSlug, versionSlug);

  return (
    <div className="flex h-dvh flex-col">
      <CourseTheme theme={course.theme} primaryColor={course.primaryColor} />
      <SiteHeader>
        <Separator orientation="vertical" className="mx-2 hidden h-5 sm:block" />
        <Badge variant="secondary" className="gap-1">
          <PenLineIcon className="size-3" /> Studio
        </Badge>
        <span className="hidden truncate text-sm font-medium md:block">{course.title}</span>
        <StudioVersionSwitcher courseSlug={course.slug} current={version.slug} versions={course.versions} />
        {version.frozenAt ? <Badge variant="outline">Đã khoá</Badge> : null}
        <span className="ml-auto flex items-center gap-1">
          {course.role === 'OWNER' ? (
            <>
              <Link
                href={`/studio/${course.slug}/analytics?version=${version.slug}`}
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
                <ChartColumnIcon /> <span className="hidden sm:inline">Thống kê</span>
              </Link>
              <Link href={`/studio/${course.slug}/settings`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                <SettingsIcon /> <span className="hidden sm:inline">Cài đặt</span>
              </Link>
            </>
          ) : null}
          <Link href={readerHref(course.slug, version.slug)} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <BookOpenIcon /> <span className="hidden sm:inline">Trang đọc</span>
          </Link>
        </span>
      </SiteHeader>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-80 shrink-0 flex-col border-r md:flex">
          <StudioTree
            tree={tree}
            courseSlug={course.slug}
            versionSlug={version.slug}
            versionId={version.id}
            role={course.role}
            readOnly={version.frozenAt !== null}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
