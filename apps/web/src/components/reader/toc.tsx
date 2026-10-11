'use client';

import { BookmarkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TocItem } from '@/lib/api-types';
import { useDocLearning } from './doc-learning';

/** Mục lục trang (h2–h3), tô đậm mục đang đọc theo vị trí cuộn. */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  const learning = useDocLearning();

  useEffect(() => {
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const onScroll = () => {
      // Heading cuối cùng đã đi qua mép trên (dưới header 80px) là mục đang đọc.
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= 96) current = heading.id;
        else break;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  if (items.length === 0) return null;
  return (
    <nav aria-label="Trên trang này" className="text-sm">
      <p className="mb-3 font-medium">Trên trang này</p>
      <ul className="flex flex-col gap-1.5 border-l">
        {items.map((item) => (
          <li key={item.id} className="group flex items-start">
            <a
              href={`#${item.id}`}
              className={cn(
                '-ml-px block min-w-0 flex-1 border-l border-transparent py-0.5 text-muted-foreground transition-colors hover:text-foreground',
                item.depth === 2 ? 'pl-3' : 'pl-6',
                active === item.id && 'border-primary font-medium text-primary',
              )}
            >
              {item.text}
            </a>
            {learning ? (
              <TocBookmark
                saved={learning.bookmarks.has(item.id)}
                label={item.text}
                onToggle={() => learning.toggleBookmark(item.id, item.text)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Lưu một mục để quay lại sau; hiện khi rê chuột, luôn hiện nếu đã lưu. */
function TocBookmark({ saved, label, onToggle }: { saved: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? `Bỏ lưu mục ${label}` : `Lưu mục ${label}`}
      className={cn(
        'mt-0.5 ml-1 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100',
        saved && 'text-primary opacity-100',
      )}
    >
      <BookmarkIcon className={cn('size-3.5', saved && 'fill-current')} />
    </button>
  );
}
