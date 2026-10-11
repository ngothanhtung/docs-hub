'use client';

import { CheckCircle2Icon, ChevronRightIcon } from 'lucide-react';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { CategoryNode, CourseProgress, TreeNode } from '@/lib/api-types';

const KNOWN_ICONS = new Set<string>(iconNames);

export interface SidebarNavProps {
  tree: TreeNode[];
  basePath: string;
  completed: string[];
  progress: Pick<CourseProgress, 'total' | 'percent'>;
}

interface ListContext {
  basePath: string;
  current: string;
  done: Set<string>;
}

/** Sidebar kiểu Docusaurus: nhóm bài thu gọn được, bài đang đọc được tô đậm, bài đã học có dấu check. */
export function SidebarNav({ tree, basePath, completed, progress }: SidebarNavProps) {
  const pathname = decodeURIComponent(usePathname());
  const current = pathname.startsWith(`${basePath}/`) ? pathname.slice(basePath.length + 1) : '';

  return (
    <nav aria-label="Mục lục khoá học" className="text-sm">
      {progress.total > 0 ? <ProgressBar done={completed.length} {...progress} /> : null}
      <NodeList nodes={tree} ctx={{ basePath, current, done: new Set(completed) }} depth={0} />
    </nav>
  );
}

function ProgressBar({ done, total, percent }: { done: number; total: number; percent: number }) {
  return (
    <div className="mb-4 px-2">
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
        <span>
          Đã học {done}/{total} bài
        </span>
        <span className="font-medium text-foreground tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Tiến độ khoá học"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function NodeList({ nodes, ctx, depth }: { nodes: TreeNode[]; ctx: ListContext; depth: number }) {
  const { basePath, current, done } = ctx;
  return (
    <ul className={cn('flex flex-col gap-0.5', depth > 0 && 'mt-0.5 ml-3 border-l pl-2')}>
      {nodes.map((node) =>
        node.type === 'doc' ? (
          <li key={node.id}>
            <Link
              href={`${basePath}/${node.path}`}
              aria-current={node.path === current ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                node.path === current && 'bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary',
              )}
            >
              <span className="min-w-0 flex-1">{node.label}</span>
              {done.has(node.id) ? (
                <CheckCircle2Icon className="size-3.5 shrink-0 text-primary" aria-label="Đã học" />
              ) : null}
            </Link>
          </li>
        ) : (
          <CategoryItem key={node.id} node={node} ctx={ctx} depth={depth} />
        ),
      )}
    </ul>
  );
}

function CategoryItem({ node, ctx, depth }: { node: CategoryNode; ctx: ListContext; depth: number }) {
  const { basePath, current } = ctx;
  const containsCurrent = current === node.path || current.startsWith(`${node.path}/`);
  const [open, setOpen] = useState(containsCurrent || !node.collapsed);
  const expanded = open || containsCurrent;

  return (
    <li>
      <div
        className={cn(
          'flex items-center rounded-md transition-colors hover:bg-muted',
          current === node.path && 'bg-primary/10 text-primary',
        )}
      >
        <Link
          href={`${basePath}/${node.path}`}
          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 font-medium"
        >
          {node.icon && KNOWN_ICONS.has(node.icon) ? (
            <DynamicIcon name={node.icon as IconName} className="size-4 shrink-0 text-muted-foreground" />
          ) : null}
          <span className="truncate">{node.label}</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? `Thu gọn ${node.label}` : `Mở ${node.label}`}
          className="mr-1 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronRightIcon className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
        </button>
      </div>
      {expanded ? (
        <NodeList nodes={node.children} ctx={ctx} depth={depth + 1} />
      ) : null}
    </li>
  );
}
