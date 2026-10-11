'use client';

import { BookmarkIcon, HashIcon, NotebookPenIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Bookmark, DocLink, Note } from '@/lib/api-types';
import { ClientApiError, clientApi } from '@/lib/client-api';

function docHref(doc: DocLink, anchor?: string | null) {
  if (!doc.path) return null;
  return `/courses/${doc.courseSlug}/${doc.versionSlug}/${doc.path}${anchor ? `#${anchor}` : ''}`;
}

export function SavedLists({ bookmarks, notes }: { bookmarks: Bookmark[]; notes: Note[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  const remove = async (path: string, id: string, message: string) => {
    setRemoving(id);
    try {
      await clientApi(path, { method: 'DELETE' });
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Tabs defaultValue="bookmarks">
      <TabsList>
        <TabsTrigger value="bookmarks">
          <BookmarkIcon /> Đã lưu ({bookmarks.length})
        </TabsTrigger>
        <TabsTrigger value="notes">
          <NotebookPenIcon /> Ghi chú ({notes.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="bookmarks" className="mt-4">
        {bookmarks.length === 0 ? (
          <Empty>Chưa lưu bài nào. Bấm “Lưu bài” ở đầu bài hoặc biểu tượng bookmark trong mục lục.</Empty>
        ) : (
          <ul className="divide-y rounded-lg border">
            {bookmarks.map((bookmark) => {
              const href = docHref(bookmark.doc, bookmark.anchor);
              return (
                <li key={bookmark.id} className="flex items-center gap-3 px-4 py-3">
                  {bookmark.anchor ? (
                    <HashIcon className="size-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <BookmarkIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <DocTitle href={href}>
                      {bookmark.anchor && bookmark.label ? bookmark.label : bookmark.doc.title}
                    </DocTitle>
                    <p className="truncate text-xs text-muted-foreground">
                      {bookmark.doc.courseTitle}
                      {bookmark.anchor ? ` · ${bookmark.doc.title}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Bỏ lưu"
                    disabled={removing === bookmark.id}
                    onClick={() => remove(`/me/bookmarks/${bookmark.id}`, bookmark.id, 'Đã bỏ lưu')}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        {notes.length === 0 ? (
          <Empty>Chưa có ghi chú. Trong bài, bôi đen một đoạn rồi bấm “Ghi chú”.</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {notes.map((note) => {
              const href = docHref(note.doc, note.anchor);
              return (
                <li key={note.id} className="flex flex-col gap-2 rounded-lg border p-4 text-sm">
                  <div className="min-w-0">
                    <DocTitle href={href}>{note.doc.title}</DocTitle>
                    <p className="truncate text-xs text-muted-foreground">{note.doc.courseTitle}</p>
                  </div>
                  {note.quote ? (
                    <blockquote className="border-l-2 pl-3 text-muted-foreground italic">“{note.quote}”</blockquote>
                  ) : null}
                  <p className="whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(note.createdAt).toLocaleString('vi-VN')}</span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Xoá ghi chú"
                      disabled={removing === note.id}
                      onClick={() => remove(`/me/notes/${note.id}`, note.id, 'Đã xoá ghi chú')}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function DocTitle({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? (
    <Link href={href} className="block truncate font-medium hover:underline">
      {children}
    </Link>
  ) : (
    <span className="block truncate font-medium text-muted-foreground" title="Bài đã bị gỡ">
      {children} (đã gỡ)
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}
