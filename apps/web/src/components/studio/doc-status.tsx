import { cn } from '@/lib/utils';
import type { DocStatus } from '@/lib/api-types';

export type StatusKind = 'archived' | 'review' | 'scheduled' | 'changed' | 'published' | 'draft';

interface StatusInput {
  status: DocStatus;
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
  publishAt: string | null;
}

const LABEL: Record<StatusKind, string> = {
  archived: 'Lưu trữ',
  review: 'Chờ duyệt',
  scheduled: 'Hẹn giờ',
  changed: 'Có thay đổi chưa xuất bản',
  published: 'Đã xuất bản',
  draft: 'Nháp, chưa xuất bản',
};

const DOT: Record<StatusKind, string> = {
  archived: 'bg-muted-foreground/40',
  review: 'bg-sky-500',
  scheduled: 'bg-violet-500',
  changed: 'bg-amber-500',
  published: 'bg-emerald-500',
  draft: 'bg-muted-foreground/60',
};

/** Một trạng thái duy nhất cho mỗi bài, theo thứ tự ưu tiên người soạn cần biết nhất. */
export function statusKind(input: StatusInput): StatusKind {
  if (input.status === 'ARCHIVED') return 'archived';
  if (input.status === 'IN_REVIEW') return 'review';
  if (input.isPublished && input.publishAt && new Date(input.publishAt) > new Date()) return 'scheduled';
  if (input.isPublished && input.hasUnpublishedChanges) return 'changed';
  if (input.isPublished) return 'published';
  return 'draft';
}

export function statusLabel(kind: StatusKind) {
  return LABEL[kind];
}

export function StatusDot({ kind, className }: { kind: StatusKind; className?: string }) {
  return (
    <span
      role="img"
      aria-label={LABEL[kind]}
      title={LABEL[kind]}
      className={cn('inline-block size-2 shrink-0 rounded-full', DOT[kind], className)}
    />
  );
}

export function StatusBadge({ kind }: { kind: StatusKind }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap">
      <StatusDot kind={kind} />
      {LABEL[kind]}
    </span>
  );
}
