import { ArrowRightIcon, BookOpenIcon, GraduationCapIcon, PenLineIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CreateCourseDialog } from '@/components/create-course-dialog';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch, getCurrentUser } from '@/lib/api';
import type { CourseListItem, CourseRole, ProgressSummary } from '@/lib/api-types';
import { readerHref } from '@/lib/reader';

export const metadata: Metadata = { title: 'Khoá học của tôi' };

const ROLE_LABEL: Record<CourseRole, string> = {
  OWNER: 'Chủ khoá',
  EDITOR: 'Biên tập',
  LEARNER: 'Học viên',
};

export default async function HomePage() {
  const [user, courses, progress] = await Promise.all([
    getCurrentUser(),
    apiFetch<CourseListItem[]>('/courses'),
    apiFetch<ProgressSummary[]>('/me/progress/summary'),
  ]);
  const progressByCourse = new Map(progress.map((p) => [p.courseId, p]));
  const canCreate = user.systemRole === 'ADMIN' || user.systemRole === 'INSTRUCTOR';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Khoá học của tôi</h1>
          <p className="text-sm text-muted-foreground">Xin chào {user.name}, chọn khoá học để đọc tài liệu.</p>
        </div>
        {canCreate ? <CreateCourseDialog /> : null}
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
          <GraduationCapIcon className="size-10 text-muted-foreground" />
          <p className="font-medium">Bạn chưa tham gia khoá học nào</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {canCreate
              ? 'Tạo khoá học đầu tiên để bắt đầu viết tài liệu.'
              : `Hãy gửi email ${user.email} cho giảng viên để được ghi danh vào khoá học.`}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const canWrite = course.role === 'OWNER' || course.role === 'EDITOR';
            const mine = progressByCourse.get(course.id);
            // Học viên luôn thấy tiến độ; người soạn bài chỉ thấy khi đã tự đọc.
            const showProgress = mine && mine.total > 0 && (course.role === 'LEARNER' || mine.completed > 0);
            return (
              <Card key={course.id} className="h-full transition-colors hover:border-primary/40">
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <BookOpenIcon className="size-5" />
                    </span>
                    {course.role ? <Badge variant="secondary">{ROLE_LABEL[course.role]}</Badge> : null}
                    {course.archivedAt ? <Badge variant="outline">Đã lưu trữ</Badge> : null}
                  </div>
                  <CardTitle className="text-base">
                    <Link href={`/courses/${course.slug}`} className="hover:underline">
                      {course.title}
                    </Link>
                  </CardTitle>
                  {course.description ? (
                    <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                  ) : null}
                </CardHeader>
                {showProgress ? <CourseProgressBlock slug={course.slug} progress={mine} /> : null}
                <CardFooter className="mt-auto flex-wrap justify-between gap-2 text-sm text-muted-foreground">
                  <span>{course.currentVersion ? `Phiên bản ${course.currentVersion.label}` : 'Chưa có phiên bản'}</span>
                  <span className="flex gap-1">
                    {canWrite ? (
                      <Link href={`/studio/${course.slug}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        <PenLineIcon /> Soạn bài
                      </Link>
                    ) : null}
                    <Link href={`/courses/${course.slug}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                      {mine?.lastDoc ? 'Đọc tiếp' : 'Đọc'} <ArrowRightIcon />
                    </Link>
                  </span>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CourseProgressBlock({ slug, progress }: { slug: string; progress: ProgressSummary }) {
  return (
    <div className="flex flex-col gap-1.5 px-(--card-spacing) text-sm">
      <div className="flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          Đã học {progress.completed}/{progress.total} bài
        </span>
        <span className="font-medium text-foreground tabular-nums">{progress.percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Tiến độ khoá học"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
      </div>
      {progress.lastDoc && progress.versionSlug ? (
        <Link
          href={readerHref(slug, progress.versionSlug, progress.lastDoc.path)}
          className="truncate text-xs text-muted-foreground hover:text-foreground"
        >
          Đang đọc: <span className="font-medium text-foreground">{progress.lastDoc.label}</span>
        </Link>
      ) : null}
    </div>
  );
}
