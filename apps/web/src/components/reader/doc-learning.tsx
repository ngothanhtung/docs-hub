'use client';

import {
  BookmarkIcon,
  CheckCircle2Icon,
  CircleIcon,
  Loader2Icon,
  NotebookPenIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import type { DocPage, Note } from '@/lib/api-types';
import { ClientApiError, clientApi, jsonBody } from '@/lib/client-api';
import { cn } from '@/lib/utils';

/** Gửi nhịp đọc mỗi 15 giây; API tự đánh dấu hoàn thành khi cuộn ≥ 90% và đọc ≥ 30 giây. */
const HEARTBEAT_MS = 15_000;

interface NoteDraft {
  quote?: string;
  anchor?: string;
}

interface LearningContext {
  docId: string;
  completed: boolean;
  setCompleted: (completed: boolean) => Promise<void>;
  bookmarks: Map<string, string>;
  toggleBookmark: (anchor: string, label: string) => Promise<void>;
  openNotes: (draft?: NoteDraft) => void;
}

const Context = createContext<LearningContext | null>(null);

export function useDocLearning() {
  return useContext(Context);
}

const errorMessage = (error: unknown) =>
  error instanceof ClientApiError ? error.message : 'Có lỗi xảy ra, vui lòng thử lại';

/**
 * Khung bài viết kèm trạng thái học tập của học viên: hoàn thành, bookmark, ghi chú.
 * Nút ở đầu bài, mục lục và cuối bài dùng chung một trạng thái.
 */
export function DocLearningLayout({
  docId,
  title,
  me,
  article,
  aside,
}: {
  docId: string;
  title: string;
  me: DocPage['me'];
  article: ReactNode;
  aside: ReactNode;
}) {
  const router = useRouter();
  const articleRef = useRef<HTMLElement>(null);
  const [completed, setCompletedState] = useState(me.completed);
  const [bookmarks, setBookmarks] = useState(() => new Map(me.bookmarks.map((b) => [b.anchor, b.id])));
  const [notesOpen, setNotesOpen] = useState(false);
  const [draft, setDraft] = useState<NoteDraft>({});

  const markCompleted = useCallback(() => {
    setCompletedState(true);
    toast.success('Đã hoàn thành bài này');
    // Làm mới sidebar để hiện dấu check và % tiến độ.
    router.refresh();
  }, [router]);

  const setCompleted = async (next: boolean) => {
    try {
      await clientApi(`/progress/${docId}/complete`, { method: 'POST', ...jsonBody({ completed: next }) });
      if (next) {
        markCompleted();
      } else {
        setCompletedState(false);
        router.refresh();
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const toggleBookmark = async (anchor: string, label: string) => {
    const existing = bookmarks.get(anchor);
    try {
      if (existing) {
        await clientApi(`/me/bookmarks/${existing}`, { method: 'DELETE' });
        setBookmarks((map) => {
          const next = new Map(map);
          next.delete(anchor);
          return next;
        });
        toast.success('Đã bỏ lưu');
      } else {
        const created = await clientApi<{ id: string }>('/me/bookmarks', {
          method: 'POST',
          ...jsonBody({ docId, anchor, label }),
        });
        setBookmarks((map) => new Map(map).set(anchor, created.id));
        toast.success(anchor ? `Đã lưu mục “${label}”` : 'Đã lưu bài này');
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Context
      value={{
        docId,
        completed,
        setCompleted,
        bookmarks,
        toggleBookmark,
        openNotes: (next) => {
          setDraft(next ?? {});
          setNotesOpen(true);
        },
      }}
    >
      <ProgressTracker docId={docId} articleRef={articleRef} completed={completed} onCompleted={markCompleted} />
      <SelectionNoteButton articleRef={articleRef} />
      <div className="flex gap-10 px-4 py-8 sm:px-8 lg:px-10">
        <article ref={articleRef} className="mx-auto w-full max-w-3xl min-w-0">
          {article}
        </article>
        <aside className="sticky top-22 hidden h-fit max-h-[calc(100dvh-7rem)] w-56 shrink-0 overflow-y-auto xl:block">
          {aside}
        </aside>
      </div>
      <NotesSheet
        docId={docId}
        docTitle={title}
        open={notesOpen}
        onOpenChange={setNotesOpen}
        draft={draft}
        clearDraft={() => setDraft({})}
      />
    </Context>
  );
}

/**
 * Đo % đã cuộn tới (lớn nhất từng đạt) và thời gian đọc khi tab đang hiển thị,
 * gửi về API định kỳ và khi rời trang.
 */
function ProgressTracker({
  docId,
  articleRef,
  completed,
  onCompleted,
}: {
  docId: string;
  articleRef: RefObject<HTMLElement | null>;
  completed: boolean;
  onCompleted: () => void;
}) {
  const state = useRef({ maxPct: 0, seconds: 0, lastTick: Date.now() });
  const completedRef = useRef(completed);
  completedRef.current = completed;

  useEffect(() => {
    const tracker = state.current;
    tracker.lastTick = Date.now();

    const measure = () => {
      const article = articleRef.current;
      if (!article) return;
      const rect = article.getBoundingClientRect();
      // 100% khi đáy bài chạm đáy màn hình; bài ngắn hơn màn hình thì coi như đã cuộn hết.
      const readable = rect.height - window.innerHeight;
      const pct = readable <= 0 ? 100 : Math.round((-rect.top / readable) * 100);
      tracker.maxPct = Math.max(tracker.maxPct, Math.min(100, Math.max(0, pct)));
    };
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') tracker.seconds += (now - tracker.lastTick) / 1000;
      tracker.lastTick = now;
    };
    const send = (keepalive = false) => {
      tick();
      const secondsDelta = Math.min(300, Math.floor(tracker.seconds));
      if (secondsDelta === 0 && tracker.maxPct === 0) return;
      tracker.seconds -= secondsDelta;
      const body = JSON.stringify({ scrollPct: tracker.maxPct, secondsDelta });
      if (keepalive) {
        void fetch(`/api/v1/progress/${docId}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
        });
        return;
      }
      clientApi<{ completed: boolean }>(`/progress/${docId}`, { method: 'PUT', body })
        .then((result) => {
          if (result.completed && !completedRef.current) onCompleted();
        })
        .catch(() => undefined);
    };

    measure();
    const interval = setInterval(() => send(), HEARTBEAT_MS);
    const onVisibility = () => (document.visibilityState === 'hidden' ? send(true) : tick());
    const onPageHide = () => send(true);
    window.addEventListener('scroll', measure, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', measure);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      // Rời bài (chuyển trang trong app): gửi nốt phần chưa gửi.
      send(true);
    };
  }, [docId, articleRef, onCompleted]);

  return null;
}

/** Nút lưu cả bài, đặt ở đầu bài. */
export function BookmarkDocButton({ title }: { title: string }) {
  const ctx = useDocLearning();
  if (!ctx) return null;
  const saved = ctx.bookmarks.has('');
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={saved}
      onClick={() => ctx.toggleBookmark('', title)}
      title={saved ? 'Bỏ lưu bài' : 'Lưu bài để đọc lại'}
    >
      <BookmarkIcon className={cn(saved && 'fill-current text-primary')} />
      {saved ? 'Đã lưu' : 'Lưu bài'}
    </Button>
  );
}

export function NotesButton() {
  const ctx = useDocLearning();
  if (!ctx) return null;
  return (
    <Button variant="ghost" size="sm" onClick={() => ctx.openNotes()}>
      <NotebookPenIcon /> Ghi chú
    </Button>
  );
}

/** Cuối bài: đánh dấu hoàn thành + "Bài này có hữu ích?". */
export function DocFooterActions({ feedback }: { feedback: DocPage['me']['feedback'] }) {
  const ctx = useDocLearning();
  const [helpful, setHelpful] = useState<boolean | null>(feedback?.helpful ?? null);
  const [comment, setComment] = useState(feedback?.comment ?? '');
  const [askComment, setAskComment] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ctx) return null;

  const sendFeedback = async (value: boolean, text?: string) => {
    setBusy(true);
    try {
      await clientApi(`/docs/${ctx.docId}/feedback`, {
        method: 'PUT',
        ...jsonBody({ helpful: value, comment: text?.trim() || undefined }),
      });
      setHelpful(value);
      setAskComment(!value && text === undefined);
      toast.success(text !== undefined ? 'Đã gửi góp ý cho giảng viên' : 'Cảm ơn bạn đã đánh giá');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
      <Button
        variant={ctx.completed ? 'secondary' : 'default'}
        onClick={() => ctx.setCompleted(!ctx.completed)}
        aria-pressed={ctx.completed}
      >
        {ctx.completed ? <CheckCircle2Icon /> : <CircleIcon />}
        {ctx.completed ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
      </Button>
      <div className="flex flex-col gap-2 sm:items-end">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Bài này có hữu ích?</span>
          <Button
            variant={helpful === true ? 'secondary' : 'ghost'}
            size="sm"
            disabled={busy}
            aria-pressed={helpful === true}
            onClick={() => sendFeedback(true)}
          >
            <ThumbsUpIcon /> Có
          </Button>
          <Button
            variant={helpful === false ? 'secondary' : 'ghost'}
            size="sm"
            disabled={busy}
            aria-pressed={helpful === false}
            onClick={() => sendFeedback(false)}
          >
            <ThumbsDownIcon /> Chưa
          </Button>
        </div>
        {askComment ? (
          <form
            className="flex w-full flex-col gap-2 sm:w-80"
            onSubmit={(event) => {
              event.preventDefault();
              void sendFeedback(false, comment);
            }}
          >
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Phần nào khó hiểu? Góp ý giúp giảng viên viết lại tốt hơn."
              aria-label="Góp ý"
            />
            <Button type="submit" size="sm" variant="outline" disabled={busy || !comment.trim()} className="self-end">
              Gửi góp ý
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

/** Bôi đen một đoạn trong bài thì hiện nút "Ghi chú" ngay cạnh đoạn đó. */
function SelectionNoteButton({ articleRef }: { articleRef: RefObject<HTMLElement | null> }) {
  const ctx = useDocLearning();
  const [selection, setSelection] = useState<{ quote: string; anchor?: string; top: number; left: number } | null>(
    null,
  );

  useEffect(() => {
    const onMouseUp = () => {
      // Đợi trình duyệt cập nhật vùng chọn xong.
      setTimeout(() => {
        const sel = window.getSelection();
        const article = articleRef.current;
        const text = sel?.toString().trim() ?? '';
        if (!sel || !article || sel.rangeCount === 0 || text.length < 3 || !article.contains(sel.anchorNode)) {
          setSelection(null);
          return;
        }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setSelection({
          quote: text.slice(0, 1000),
          anchor: nearestHeadingId(article, sel.anchorNode),
          top: rect.top - 40,
          left: rect.left + rect.width / 2,
        });
      }, 0);
    };
    const onScroll = () => setSelection(null);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('scroll', onScroll);
    };
  }, [articleRef]);

  if (!ctx || !selection) return null;
  return (
    <Button
      size="sm"
      className="fixed z-30 -translate-x-1/2 shadow-md"
      style={{ top: selection.top, left: selection.left }}
      // mousedown thay vì click: không làm mất vùng chọn trước khi đọc được nó.
      onMouseDown={(event) => {
        event.preventDefault();
        ctx.openNotes({ quote: selection.quote, anchor: selection.anchor });
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }}
    >
      <NotebookPenIcon /> Ghi chú
    </Button>
  );
}

/** id của heading h2/h3 gần nhất phía trên vị trí được chọn (để ghi chú nhảy về đúng mục). */
function nearestHeadingId(article: HTMLElement, node: Node | null): string | undefined {
  if (!node) return undefined;
  let found: string | undefined;
  for (const heading of article.querySelectorAll<HTMLElement>('h2[id], h3[id]')) {
    if (heading.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) found = heading.id;
    else break;
  }
  return found;
}

type NoteItem = Omit<Note, 'doc'>;

function NotesSheet({
  docId,
  docTitle,
  open,
  onOpenChange,
  draft,
  clearDraft,
}: {
  docId: string;
  docTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: NoteDraft;
  clearDraft: () => void;
}) {
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    clientApi<Note[]>(`/me/notes?docId=${docId}`)
      .then(setNotes)
      .catch(() => setNotes([]));
  }, [open, docId]);

  const save = async () => {
    setSaving(true);
    try {
      const created = await clientApi<NoteItem>('/me/notes', {
        method: 'POST',
        ...jsonBody({ docId, content: content.trim(), quote: draft.quote, anchor: draft.anchor }),
      });
      setNotes((list) => [created, ...(list ?? [])]);
      setContent('');
      clearDraft();
      toast.success('Đã lưu ghi chú');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await clientApi(`/me/notes/${id}`, { method: 'DELETE' });
      setNotes((list) => list?.filter((n) => n.id !== id) ?? null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Ghi chú của tôi</SheetTitle>
          <SheetDescription>{docTitle} · chỉ mình bạn xem được.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (content.trim()) void save();
            }}
          >
            {draft.quote ? (
              <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground italic">“{draft.quote}”</blockquote>
            ) : null}
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={draft.quote ? 'Ghi chú cho đoạn đã chọn…' : 'Ghi chú cho bài này… (mẹo: bôi đen một đoạn để ghi chú theo đoạn)'}
              aria-label="Nội dung ghi chú"
              autoFocus
            />
            <Button type="submit" size="sm" className="self-end" disabled={saving || !content.trim()}>
              {saving ? <Loader2Icon className="animate-spin" /> : null} Lưu ghi chú
            </Button>
          </form>
          {notes === null ? (
            <p className="text-sm text-muted-foreground">Đang tải…</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có ghi chú nào cho bài này.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-lg border p-3 text-sm">
                  {note.quote ? (
                    <a
                      href={note.anchor ? `#${note.anchor}` : undefined}
                      className="mb-2 block border-l-2 pl-3 text-muted-foreground italic"
                      onClick={() => onOpenChange(false)}
                    >
                      “{note.quote}”
                    </a>
                  ) : null}
                  <p className="whitespace-pre-wrap">{note.content}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(note.createdAt).toLocaleString('vi-VN')}</span>
                    <Button variant="ghost" size="icon-xs" aria-label="Xoá ghi chú" onClick={() => remove(note.id)}>
                      <Trash2Icon />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
