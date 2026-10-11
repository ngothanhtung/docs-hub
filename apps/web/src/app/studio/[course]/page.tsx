import { redirect } from 'next/navigation';
import { getStudioCourse, studioHref } from '@/lib/studio';

/** /studio/nestjs -> Studio của version hiện hành. */
export default async function StudioCoursePage({ params }: PageProps<'/studio/[course]'>) {
  const { course: slug } = await params;
  const course = await getStudioCourse(slug);
  const version = course.versions.find((v) => v.isCurrent) ?? course.versions[0];
  redirect(studioHref(course.slug, version.slug));
}
