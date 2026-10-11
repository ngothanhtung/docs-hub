import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocEditor } from '@/components/studio/doc-editor';
import { getEditorDoc, getStudioContext } from '@/lib/studio';

type Props = PageProps<'/studio/[course]/[version]/docs/[docId]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { docId } = await params;
  const doc = await getEditorDoc(docId);
  return { title: `Soạn: ${doc.title}` };
}

export default async function EditorPage({ params }: Props) {
  const { course, version, docId } = await params;
  const [{ course: c, version: v }, doc] = await Promise.all([
    getStudioContext(course, version),
    getEditorDoc(docId),
  ]);
  if (doc.versionId !== v.id) notFound();
  // key: mở bài khác thì dựng lại editor từ đầu, không giữ trạng thái của bài trước.
  return <DocEditor key={doc.id} doc={doc} courseId={c.id} versionId={v.id} />;
}
