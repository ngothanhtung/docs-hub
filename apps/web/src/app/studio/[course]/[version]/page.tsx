import { FilePenLineIcon } from 'lucide-react';
import type { Metadata } from 'next';
import type { StudioTreeNode } from '@/lib/api-types';
import { getStudioContext } from '@/lib/studio';

export const metadata: Metadata = { title: 'Studio' };

function countDocs(nodes: StudioTreeNode[]): { total: number; published: number; pending: number } {
  return nodes.reduce(
    (acc, node) => {
      if (node.type === 'category') {
        const inner = countDocs(node.children);
        return {
          total: acc.total + inner.total,
          published: acc.published + inner.published,
          pending: acc.pending + inner.pending,
        };
      }
      return {
        total: acc.total + 1,
        published: acc.published + (node.meta.isPublished ? 1 : 0),
        pending: acc.pending + (node.meta.hasUnpublishedChanges && node.meta.status !== 'ARCHIVED' ? 1 : 0),
      };
    },
    { total: 0, published: 0, pending: 0 },
  );
}

export default async function StudioHome({ params }: PageProps<'/studio/[course]/[version]'>) {
  const { course, version } = await params;
  const { tree } = await getStudioContext(course, version);
  const stats = countDocs(tree);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <FilePenLineIcon className="size-10 text-muted-foreground" />
      <div>
        <p className="font-medium">Chọn một bài ở cây nội dung để bắt đầu soạn</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hoặc bấm <strong>Bài mới</strong> để tạo bài đầu tiên của phiên bản này.
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-6 text-sm">
        <div>
          <dt className="text-muted-foreground">Bài viết</dt>
          <dd className="text-2xl font-semibold">{stats.total}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Đã xuất bản</dt>
          <dd className="text-2xl font-semibold">{stats.published}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Chờ xuất bản</dt>
          <dd className="text-2xl font-semibold">{stats.pending}</dd>
        </div>
      </dl>
    </div>
  );
}
