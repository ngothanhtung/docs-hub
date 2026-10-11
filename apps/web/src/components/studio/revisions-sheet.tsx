'use client';

import { ArrowLeftIcon, HistoryIcon, Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { DocContent } from '@/components/reader/doc-content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { handlePreviewLinkClick } from './preview-links';
import type { DocMutationResult, RevisionDetail, RevisionListItem } from '@/lib/api-types';
import { ClientApiError, clientApi } from '@/lib/client-api';

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

/** Lịch sử revision của bài: xem lại nội dung từng bản và khôi phục. */
export function RevisionsSheet({
  docId,
  open,
  onOpenChange,
  canRestore,
  beforeRestore,
  onRestored,
}: {
  docId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canRestore: boolean;
  beforeRestore: () => Promise<boolean>;
  onRestored: (source: string, result: DocMutationResult) => void;
}) {
  const [items, setItems] = useState<RevisionListItem[] | null>(null);
  const [selected, setSelected] = useState<RevisionDetail | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setItems(null);
    clientApi<RevisionListItem[]>(`/docs/${docId}/revisions`)
      .then(setItems)
      .catch(() => toast.error('Không tải được lịch sử'));
  }, [open, docId]);

  const view = async (number: number) => {
    try {
      setSelected(await clientApi<RevisionDetail>(`/docs/${docId}/revisions/${number}`));
    } catch {
      toast.error('Không tải được bản này');
    }
  };

  const restore = async (revision: RevisionDetail) => {
    setRestoring(true);
    try {
      if (!(await beforeRestore())) return;
      const result = await clientApi<DocMutationResult>(`/docs/${docId}/revisions/${revision.number}/restore`, {
        method: 'POST',
      });
      onRestored(revision.source, result);
      toast.success(`Đã khôi phục bản #${revision.number} thành bản #${result.revision?.number}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Không khôi phục được');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4" /> Lịch sử thay đổi
          </SheetTitle>
          <SheetDescription>
            Revision được tạo khi bấm Lưu (Ctrl/⌘+S), gửi duyệt, xuất bản hoặc khôi phục. Autosave chỉ cập nhật bản nháp.
          </SheetDescription>
        </SheetHeader>

        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b px-4 py-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <ArrowLeftIcon /> Danh sách
              </Button>
              <span className="text-sm font-medium">Bản #{selected.number}</span>
              <span className="text-xs text-muted-foreground">{formatTime(selected.createdAt)}</span>
              {canRestore ? (
                <Button size="sm" className="ml-auto" disabled={restoring} onClick={() => restore(selected)}>
                  {restoring ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
                  Khôi phục bản này
                </Button>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4" onClickCapture={handlePreviewLinkClick}>
              <DocContent html={selected.html} />
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {items === null ? (
              <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Đang tải…
              </p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Chưa có revision nào. Bấm Lưu (Ctrl/⌘+S) để tạo bản đầu tiên.
              </p>
            ) : (
              <ul className="flex flex-col">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => view(item.number)}
                      className="flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left hover:bg-muted"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        Bản #{item.number}
                        {item.isPublished ? <Badge variant="secondary">Đang xuất bản</Badge> : null}
                        <span className="ml-auto text-xs font-normal text-muted-foreground">
                          {formatTime(item.createdAt)}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.message ?? 'Không có ghi chú'} · {item.author?.name ?? 'Không rõ'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
