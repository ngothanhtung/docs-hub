import { redirect } from 'next/navigation';
import { EmptyCourse } from '@/components/reader/empty-course';
import { firstDocPath, getReaderTree, readerHref } from '@/lib/reader';

/** /courses/nestjs/2026 -> bài đầu tiên của version đó. */
export default async function VersionPage({ params }: PageProps<'/courses/[course]/[version]'>) {
  const { course, version } = await params;
  const { role, tree } = await getReaderTree(course, version);
  const first = firstDocPath(tree);
  if (first) redirect(readerHref(course, version, first));
  return <EmptyCourse role={role} />;
}
