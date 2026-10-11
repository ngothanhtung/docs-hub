import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, FileTextIcon, FolderIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import { DocContent } from '@/components/reader/doc-content';
import {
  BookmarkDocButton,
  DocFooterActions,
  DocLearningLayout,
  NotesButton,
} from '@/components/reader/doc-learning';
import { Toc } from '@/components/reader/toc';
import { apiFetchOrNotFound } from '@/lib/api';
import type { CategoryPage, DocPage, ReaderPage } from '@/lib/api-types';
import { readerHref } from '@/lib/reader';

type Props = PageProps<'/courses/[course]/[version]/[...path]'>;

const getPage = cache((course: string, version: string, path: string) =>
  apiFetchOrNotFound<ReaderPage>(
    `/read/${encodeURIComponent(course)}/page?version=${encodeURIComponent(version)}&path=${encodeURIComponent(path)}`,
  ),
);

async function load(params: Props['params']) {
  const { course, version, path } = await params;
  return { course, version, page: await getPage(course, version, path.join('/')) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page } = await load(params);
  const title = page.type === 'doc' ? page.doc.title : page.category.label;
  return { title: `${title} · ${page.course.title}` };
}

export default async function ReaderPathPage({ params }: Props) {
  const { course, version, page } = await load(params);
  const basePath = readerHref(course, version);
  return page.type === 'doc' ? (
    <DocView page={page} basePath={basePath} />
  ) : (
    <CategoryView page={page} basePath={basePath} />
  );
}

function DocView({ page, basePath }: { page: DocPage; basePath: string }) {
  const { doc } = page;
  // Bài tự viết "# Tiêu đề" ở đầu thì không lặp lại tiêu đề.
  const hasOwnH1 = doc.html.trimStart().startsWith('<h1');
  const updated = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'long' }).format(new Date(doc.updatedAt));

  return (
    <DocLearningLayout
      // key: chuyển bài thì đo tiến độ và trạng thái bookmark lại từ đầu.
      key={doc.id}
      docId={doc.id}
      title={doc.title}
      me={page.me}
      article={
        <>
          <Breadcrumbs items={page.breadcrumb} basePath={basePath} />
          {hasOwnH1 ? null : <h1 className="mb-2 text-3xl font-bold tracking-tight">{doc.title}</h1>}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <ClockIcon className="size-4" />
              {doc.readingTime} phút đọc · Cập nhật {updated}
            </p>
            <div className="-mr-2 flex items-center">
              <BookmarkDocButton title={doc.title} />
              <NotesButton />
            </div>
          </div>
          <DocContent html={doc.html} />
          <DocFooterActions feedback={page.me.feedback} />
          <Pager prev={page.prev} next={page.next} basePath={basePath} />
        </>
      }
      aside={<Toc items={doc.toc} />}
    />
  );
}

function CategoryView({ page, basePath }: { page: CategoryPage; basePath: string }) {
  const { category } = page;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
      <Breadcrumbs items={page.breadcrumb} basePath={basePath} />
      <h1 className="mb-2 text-3xl font-bold tracking-tight">{category.label}</h1>
      {category.description ? <p className="mb-8 text-muted-foreground">{category.description}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {category.items.map((item) => (
          <Link
            key={item.id}
            href={`${basePath}/${item.path}`}
            className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-muted/50"
          >
            {item.type === 'category' ? (
              <FolderIcon className="size-5 shrink-0 text-muted-foreground" />
            ) : (
              <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
            )}
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Breadcrumbs({ items, basePath }: { items: DocPage['breadcrumb']; basePath: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, index) => (
        <span key={item.path} className="flex items-center gap-1">
          {index > 0 ? <ChevronRightIcon className="size-3.5" /> : null}
          <Link href={`${basePath}/${item.path}`} className="hover:text-foreground">
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

function Pager({
  prev,
  next,
  basePath,
}: {
  prev: DocPage['prev'];
  next: DocPage['next'];
  basePath: string;
}) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Bài trước và bài sau" className="mt-12 grid gap-4 border-t pt-8 sm:grid-cols-2">
      {prev ? (
        <Link
          href={`${basePath}/${prev.path}`}
          className="flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:border-primary/40"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronLeftIcon className="size-3.5" /> Bài trước
          </span>
          <span className="font-medium">{prev.label}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={`${basePath}/${next.path}`}
          className="flex flex-col items-end gap-1 rounded-lg border p-4 text-right transition-colors hover:border-primary/40"
        >
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            Bài sau <ChevronRightIcon className="size-3.5" />
          </span>
          <span className="font-medium">{next.label}</span>
        </Link>
      ) : null}
    </nav>
  );
}
