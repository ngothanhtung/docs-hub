import type { Metadata } from 'next';
import { SavedLists } from '@/components/saved-lists';
import { apiFetch } from '@/lib/api';
import type { Bookmark, Note } from '@/lib/api-types';

export const metadata: Metadata = { title: 'Đã lưu & ghi chú' };

export default async function SavedPage() {
  const [bookmarks, notes] = await Promise.all([
    apiFetch<Bookmark[]>('/me/bookmarks'),
    apiFetch<Note[]>('/me/notes'),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Đã lưu & ghi chú</h1>
        <p className="text-sm text-muted-foreground">
          Bài và mục bạn đã lưu, cùng ghi chú riêng của bạn ở mọi khoá học.
        </p>
      </div>
      <SavedLists bookmarks={bookmarks} notes={notes} />
    </div>
  );
}
