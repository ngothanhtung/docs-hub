'use client';

import { FileTextIcon, HashIcon, Loader2Icon, SearchIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { SearchHit } from '@/lib/api-types';
import { clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 200;

/** Tìm kiếm trong khoá học: bấm nút hoặc Ctrl/⌘+K. Kết quả là từng mục của bài, Enter để mở. */
export function SearchDialog({ courseSlug, versionSlug }: { courseSlug: string; versionSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, version: versionSlug });
        const result = await clientApi<{ hits: SearchHit[] }>(
          `/read/${courseSlug}/search?${params}`,
          { signal: controller.signal },
        );
        setHits(result.hits);
        setActive(0);
      } catch {
        // Bị huỷ vì gõ tiếp, hoặc lỗi mạng: giữ kết quả cũ.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, courseSlug, versionSlug]);

  // Gom các mục của cùng một bài, giữ thứ tự xếp hạng của bài xuất hiện đầu tiên.
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; items: { hit: SearchHit; index: number }[] }>();
    hits.forEach((hit, index) => {
      const group = map.get(hit.docId) ?? { title: hit.title, items: [] };
      group.items.push({ hit, index });
      map.set(hit.docId, group);
    });
    return [...map.values()];
  }, [hits]);

  const go = (hit: SearchHit) => {
    setOpen(false);
    router.push(`/courses/${courseSlug}/${versionSlug}/${hit.path}${hit.anchor ? `#${hit.anchor}` : ''}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = event.key === 'ArrowDown' ? Math.min(active + 1, hits.length - 1) : Math.max(active - 1, 0);
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && hits[active]) {
      event.preventDefault();
      go(hits[active]);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full max-w-64 justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <SearchIcon />
        <span className="flex-1 text-left">Tìm trong khoá học</span>
        <kbd className="hidden rounded border px-1 font-mono text-[10px] sm:inline">⌘K</kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <DialogContent showCloseButton={false} className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Tìm kiếm</DialogTitle>
          <div className="flex items-center gap-2 border-b px-3">
            {loading ? (
              <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Gõ để tìm, có dấu hoặc không dấu…"
              aria-label="Từ khoá tìm kiếm"
              role="combobox"
              aria-expanded={hits.length > 0}
              aria-controls="search-results"
              aria-activedescendant={hits[active] ? `search-hit-${active}` : undefined}
              className="h-12 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <div ref={listRef} id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-2 [&_mark]:rounded-sm [&_mark]:bg-primary/20 [&_mark]:text-foreground">
            {!query.trim() ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Tìm theo tiêu đề bài, heading hoặc nội dung.
              </p>
            ) : hits.length === 0 && !loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Không có kết quả cho “{query.trim()}”.
              </p>
            ) : (
              groups.map((group) => (
                <div key={group.items[0].hit.docId} className="mb-2">
                  <p
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground"
                    // Tiêu đề do API thoát HTML, chỉ còn thẻ <mark>.
                    dangerouslySetInnerHTML={{ __html: group.title }}
                  />
                  {group.items.map(({ hit, index }) => (
                    <button
                      key={`${hit.docId}-${hit.anchor}`}
                      id={`search-hit-${index}`}
                      data-index={index}
                      type="button"
                      role="option"
                      aria-selected={index === active}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(hit)}
                      className={cn(
                        'flex w-full gap-3 rounded-md px-2 py-2 text-left text-sm',
                        index === active && 'bg-muted',
                      )}
                    >
                      {hit.heading ? (
                        <HashIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0">
                        <span
                          className="block font-medium"
                          dangerouslySetInnerHTML={{ __html: hit.heading ?? hit.title }}
                        />
                        {hit.snippet ? (
                          <span
                            className="line-clamp-2 text-xs text-muted-foreground"
                            dangerouslySetInnerHTML={{ __html: hit.snippet }}
                          />
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
