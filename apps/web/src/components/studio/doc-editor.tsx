'use client';

import type { EditorView } from '@codemirror/view';
import {
  AlertCircleIcon,
  BookOpenIcon,
  CheckIcon,
  CloudUploadIcon,
  ColumnsIcon,
  EyeIcon,
  HistoryIcon,
  Loader2Icon,
  LockIcon,
  PencilIcon,
  SaveIcon,
  SendIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { DocContent } from '@/components/reader/doc-content';
import { Button, buttonVariants } from '@/components/ui/button';
import type {
  DocMutationResult,
  DocStatus,
  DocSummary,
  EditorDoc,
  RenderResult,
  RenderWarning,
} from '@/lib/api-types';
import { ClientApiError, clientApi, jsonBody } from '@/lib/client-api';
import {
  altFromFilename,
  checkImage,
  IMAGE_TYPES,
  ImageRejectedError,
  uploadImage,
} from '@/lib/upload-image';
import { cn } from '@/lib/utils';
import { StatusBadge, statusKind } from './doc-status';
import { goToLine } from './editor-commands';
import { EditorToolbar } from './editor-toolbar';

import { handlePreviewLinkClick } from './preview-links';
import { PublishDialog } from './publish-dialog';
import { RevisionsSheet } from './revisions-sheet';

// CodeMirror chỉ chạy được trên trình duyệt và theme phụ thuộc giao diện sáng/tối của máy:
// không render phía server để tránh lệch hydration.
const MarkdownEditor = dynamic(() => import('./markdown-editor').then((m) => m.MarkdownEditor), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse bg-muted/30" />,
});

/** Ngừng gõ 2 giây thì tự lưu bản nháp. */
const AUTOSAVE_MS = 2000;
const PREVIEW_MS = 350;
/** Gia hạn khoá mềm (API cho hết hạn sau 2 phút). */
const LOCK_HEARTBEAT_MS = 60_000;

type SaveState =
  | { kind: 'saved'; at: Date }
  | { kind: 'dirty' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string; line: number | null }
  | { kind: 'conflict'; message: string };

interface Meta {
  status: DocStatus;
  title: string;
  isPublished: boolean;
  hasUnpublishedChanges: boolean;
  publishAt: string | null;
}

interface Preview {
  html: string;
  warnings: RenderWarning[];
  error: { message: string; line: number | null } | null;
}

function metaFromSummary(doc: DocSummary): Meta {
  return {
    status: doc.status,
    title: doc.title,
    isPublished: doc.publishedRevisionId !== null,
    hasUnpublishedChanges:
      doc.publishedAt === null || new Date(doc.sourceUpdatedAt) > new Date(doc.publishedAt),
    publishAt: doc.publishAt,
  };
}

export function DocEditor({
  doc,
  courseId,
  versionId,
}: {
  doc: EditorDoc;
  courseId: string;
  versionId: string;
}) {
  const router = useRouter();
  const backupKey = `docshub:draft:${doc.id}`;

  const [source, setSource] = useState(doc.source);
  const [meta, setMeta] = useState<Meta>({
    status: doc.status,
    title: doc.title,
    isPublished: doc.publishedRevision !== null,
    hasUnpublishedChanges: doc.hasUnpublishedChanges,
    publishAt: doc.publishAt,
  });
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'saved', at: new Date(doc.sourceUpdatedAt) });
  const [preview, setPreview] = useState<Preview>({ html: '', warnings: [], error: null });
  const [view, setView] = useState<EditorView | null>(null);
  const [mode, setMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [lockHolder, setLockHolder] = useState(doc.lockedBy);
  const [recovered, setRecovered] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Giá trị cần đọc trong callback bất đồng bộ mà không làm callback đổi danh tính.
  const baseRef = useRef(doc.sourceUpdatedAt);
  const savedRef = useRef(doc.source);
  const latestRef = useRef(source);
  latestRef.current = source;
  const inflightRef = useRef<Promise<boolean> | null>(null);
  const kindRef = useRef(statusKind(meta));
  const lockAcquiredRef = useRef(false);

  const isOwner = doc.role === 'OWNER';
  const locked = doc.versionFrozen || meta.status === 'ARCHIVED';
  const readOnly = locked || saveState.kind === 'conflict';
  const kind = statusKind(meta);

  /** Cập nhật trạng thái sau mỗi lần lưu; trạng thái trên cây đổi thì làm mới cây. */
  const applySummary = useCallback(
    (summary: DocSummary) => {
      const next = metaFromSummary(summary);
      setMeta(next);
      const nextKind = statusKind(next);
      if (nextKind !== kindRef.current || next.title !== meta.title) router.refresh();
      kindRef.current = nextKind;
    },
    [router, meta.title],
  );

  /** Lưu bản nháp lên API. Trả false nếu không lưu được (lỗi đã hiện trên màn hình). */
  const persist = useCallback(
    async (options: { createRevision?: boolean; message?: string } = {}): Promise<boolean> => {
      if (inflightRef.current) await inflightRef.current;
      const body = latestRef.current;
      if (!options.createRevision && body === savedRef.current) return true;

      const run = (async () => {
        setSaveState({ kind: 'saving' });
        try {
          const result = await clientApi<DocMutationResult>(`/docs/${doc.id}/draft`, {
            method: 'PUT',
            ...jsonBody({
              source: body,
              baseUpdatedAt: baseRef.current,
              createRevision: options.createRevision,
              message: options.message,
            }),
          });
          baseRef.current = result.doc.sourceUpdatedAt;
          savedRef.current = body;
          applySummary(result.doc);
          if (latestRef.current === body) {
            localStorage.removeItem(backupKey);
            setSaveState({ kind: 'saved', at: new Date() });
          } else {
            setSaveState({ kind: 'dirty' });
          }
          if (options.createRevision && result.revision) {
            toast.success(`Đã lưu bản #${result.revision.number}`);
          }
          return true;
        } catch (error) {
          if (error instanceof ClientApiError && error.status === 409) {
            setSaveState({ kind: 'conflict', message: error.message });
          } else if (error instanceof ClientApiError && error.status === 400) {
            setSaveState({
              kind: 'error',
              message: error.message,
              line: typeof error.body?.line === 'number' ? error.body.line : null,
            });
          } else {
            setSaveState({ kind: 'error', message: 'Không lưu được, sẽ thử lại khi bạn gõ tiếp', line: null });
          }
          return false;
        }
      })();
      inflightRef.current = run;
      try {
        return await run;
      } finally {
        inflightRef.current = null;
      }
    },
    [doc.id, backupKey, applySummary],
  );

  // Autosave + bản sao dự phòng trong trình duyệt phòng khi mất mạng hoặc đóng tab.
  useEffect(() => {
    if (readOnly || source === savedRef.current) return;
    setSaveState((state) => (state.kind === 'saving' ? state : { kind: 'dirty' }));
    localStorage.setItem(backupKey, JSON.stringify({ source, at: Date.now() }));
    const timer = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [source, readOnly, persist, backupKey]);

  // Preview dùng đúng pipeline của trang đọc (render phía API).
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await clientApi<RenderResult>('/render/preview', {
          method: 'POST',
          signal: controller.signal,
          ...jsonBody({ versionId, source }),
        });
        setPreview({ html: result.html, warnings: result.warnings, error: null });
      } catch (error) {
        if (error instanceof ClientApiError && error.status === 400) {
          const line = typeof error.body?.line === 'number' ? error.body.line : null;
          setPreview((p) => ({ ...p, error: { message: error.message, line } }));
        }
      }
    }, PREVIEW_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [source, versionId]);

  // Khoá mềm: báo cho người khác biết mình đang mở bài, gia hạn định kỳ, trả khoá khi rời trang.
  useEffect(() => {
    if (doc.versionFrozen) return;
    const acquire = async () => {
      const result = await clientApi<{ acquired: boolean; lockedBy: EditorDoc['lockedBy'] }>(
        `/docs/${doc.id}/lock`,
        { method: 'POST', ...jsonBody({}) },
      );
      lockAcquiredRef.current = result.acquired;
      setLockHolder(result.lockedBy);
    };
    void acquire().catch(() => undefined);
    const timer = setInterval(() => {
      if (lockAcquiredRef.current) void acquire().catch(() => undefined);
    }, LOCK_HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      if (lockAcquiredRef.current) {
        void fetch(`/api/v1/docs/${doc.id}/lock`, { method: 'DELETE', keepalive: true });
      }
    };
  }, [doc.id, doc.versionFrozen]);

  // Lần trước đóng tab khi chưa kịp lưu: đề nghị khôi phục.
  useEffect(() => {
    const raw = localStorage.getItem(backupKey);
    if (!raw) return;
    try {
      const backup = JSON.parse(raw) as { source: string; at: number };
      if (backup.source !== doc.source && backup.at > Date.parse(doc.sourceUpdatedAt)) {
        setRecovered(backup.source);
        return;
      }
    } catch {
      // Bản sao hỏng thì bỏ.
    }
    localStorage.removeItem(backupKey);
  }, [backupKey, doc.source, doc.sourceUpdatedAt]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latestRef.current !== savedRef.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const saveRevision = useCallback(() => {
    if (!readOnly) void persist({ createRevision: true });
  }, [persist, readOnly]);

  const submitForReview = async () => {
    setBusy(true);
    try {
      if (!(await persist())) return;
      const result = await clientApi<DocMutationResult>(`/docs/${doc.id}/submit`, { method: 'POST' });
      applySummary(result.doc);
      toast.success('Đã gửi bài cho chủ khoá duyệt');
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Không gửi duyệt được');
    } finally {
      setBusy(false);
    }
  };

  const publish = async (input: { message?: string; publishAt?: string }) => {
    try {
      if (!(await persist())) {
        toast.error('Hãy sửa lỗi lưu bài trước khi xuất bản');
        return false;
      }
      const result = await clientApi<DocMutationResult>(`/docs/${doc.id}/publish`, {
        method: 'POST',
        ...jsonBody(input),
      });
      applySummary(result.doc);
      baseRef.current = result.doc.sourceUpdatedAt;
      toast.success(
        input.publishAt
          ? `Đã hẹn giờ mở bài lúc ${new Date(input.publishAt).toLocaleString('vi-VN')}`
          : `Đã xuất bản bản #${result.revision?.number}`,
      );
      if (result.warnings.length > 0) toast.warning(`Bài còn ${result.warnings.length} cảnh báo`);
      return true;
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Không xuất bản được');
      return false;
    }
  };

  const forceLock = async () => {
    const result = await clientApi<{ acquired: boolean }>(`/docs/${doc.id}/lock`, {
      method: 'POST',
      ...jsonBody({ force: true }),
    });
    lockAcquiredRef.current = result.acquired;
    setLockHolder(null);
  };

  /**
   * Chèn ảnh: đặt dòng giữ chỗ ngay để tác giả gõ tiếp, tải lên S3 xong thì thay bằng Markdown thật.
   * Lỗi thì gỡ dòng giữ chỗ và báo lý do.
   */
  const insertImages = async (files: File[], pos: number | null) => {
    if (!view || readOnly) return;
    for (const file of files) {
      try {
        checkImage(file);
      } catch (error) {
        toast.error((error as Error).message);
        continue;
      }
      const placeholder = `![Đang tải ${file.name}…]()`;
      // Ảnh phải là một đoạn riêng: cách đoạn văn phía trên một dòng trống.
      const at = pos ?? view.state.selection.main.head;
      const line = view.state.doc.lineAt(at);
      const lineEmpty = line.text.trim() === '';
      const previousEmpty = line.number === 1 || view.state.doc.line(line.number - 1).text.trim() === '';
      const from = lineEmpty ? line.from : line.to;
      const prefix = lineEmpty ? (previousEmpty ? '' : '\n') : '\n\n';
      view.dispatch({
        changes: { from, insert: `${prefix}${placeholder}\n` },
        selection: { anchor: from + prefix.length + placeholder.length + 1 },
      });
      const replacePlaceholder = (text: string) => {
        const index = view.state.doc.toString().indexOf(placeholder);
        if (index === -1) return;
        view.dispatch({ changes: { from: index, to: index + placeholder.length, insert: text } });
      };
      try {
        const url = await uploadImage(courseId, file);
        replacePlaceholder(`![${altFromFilename(file.name)}](${url})`);
      } catch (error) {
        replacePlaceholder('');
        toast.error(
          error instanceof ClientApiError || error instanceof ImageRejectedError
            ? error.message
            : `Không tải được ${file.name}`,
        );
      }
    }
    view.focus();
  };

  const warnings = preview.warnings;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{meta.title}</h1>
          <p className="truncate font-mono text-xs text-muted-foreground">/{doc.path}</p>
        </div>
        <StatusBadge kind={kind} />
        <SaveIndicator state={saveState} onRetry={() => void persist()} onGoToLine={(line) => view && goToLine(view, line)} />
        <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
          <HistoryIcon /> Lịch sử
        </Button>
        {meta.isPublished ? (
          <Link href={doc.readerUrl} target="_blank" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <BookOpenIcon /> Trang đọc
          </Link>
        ) : null}
        {!readOnly ? (
          <Button variant="outline" size="sm" onClick={saveRevision} title="Lưu thành revision (Ctrl/⌘+S)">
            <SaveIcon /> Lưu
          </Button>
        ) : null}
        {isOwner ? (
          <Button size="sm" disabled={readOnly} onClick={() => setPublishOpen(true)}>
            <CloudUploadIcon /> Xuất bản
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={readOnly || busy || meta.status === 'IN_REVIEW' || !meta.hasUnpublishedChanges}
            onClick={submitForReview}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
            {meta.status === 'IN_REVIEW' ? 'Đang chờ duyệt' : 'Gửi duyệt'}
          </Button>
        )}
      </div>

      {doc.versionFrozen ? (
        <Banner icon={LockIcon}>Phiên bản này đã khoá: chỉ xem, không chỉnh sửa được.</Banner>
      ) : meta.status === 'ARCHIVED' ? (
        <Banner icon={LockIcon}>Bài đã lưu trữ. Bỏ lưu trữ ở menu của bài trên cây nội dung để chỉnh sửa tiếp.</Banner>
      ) : null}
      {saveState.kind === 'conflict' ? (
        <Banner icon={TriangleAlertIcon} tone="danger" action={{ label: 'Tải lại bài', onClick: () => window.location.reload() }}>
          {saveState.message} Nội dung bạn đang gõ vẫn được giữ trên trình duyệt này để khôi phục sau khi tải lại.
        </Banner>
      ) : null}
      {lockHolder && !locked ? (
        <Banner icon={TriangleAlertIcon} action={{ label: 'Vẫn chỉnh sửa', onClick: () => void forceLock() }}>
          {lockHolder.name} đang mở bài này (từ{' '}
          {new Date(lockHolder.lockedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}). Hai
          người cùng sửa có thể ghi đè thay đổi của nhau.
        </Banner>
      ) : null}
      {recovered !== null && !readOnly ? (
        <Banner
          icon={AlertCircleIcon}
          action={{
            label: 'Khôi phục',
            onClick: () => {
              setSource(recovered);
              setRecovered(null);
            },
          }}
          secondary={{
            label: 'Bỏ qua',
            onClick: () => {
              localStorage.removeItem(backupKey);
              setRecovered(null);
            },
          }}
        >
          Trình duyệt này còn nội dung chưa lưu của bài từ lần soạn trước.
        </Banner>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b px-2 py-1">
        <EditorToolbar
          view={view}
          disabled={readOnly || mode === 'preview'}
          onPickImage={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          multiple
          hidden
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            event.target.value = '';
            void insertImages(files, null);
          }}
        />
        <div className="ml-auto flex items-center rounded-lg border p-0.5" role="group" aria-label="Chế độ hiển thị">
          {(
            [
              ['edit', PencilIcon, 'Soạn'],
              ['split', ColumnsIcon, 'Chia đôi'],
              ['preview', EyeIcon, 'Xem trước'],
            ] as const
          ).map(([value, Icon, label]) => (
            <Button
              key={value}
              variant={mode === value ? 'secondary' : 'ghost'}
              size="xs"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              <Icon /> <span className="hidden lg:inline">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {mode !== 'preview' ? (
          <div className={cn('min-h-0 min-w-0 flex-1', mode === 'split' && 'border-r')}>
            <MarkdownEditor
              value={source}
              onChange={setSource}
              onSave={saveRevision}
              onReady={setView}
              onImageFiles={(files, pos) => void insertImages(files, pos)}
              readOnly={readOnly}
            />
          </div>
        ) : null}
        {mode !== 'edit' ? (
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto" onClickCapture={handlePreviewLinkClick}>
            {preview.error ? (
              <div className="m-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {preview.error.message}
                {preview.error.line ? ` (dòng ${preview.error.line})` : ''}. Preview đang hiển thị bản hợp lệ gần nhất.
              </div>
            ) : null}
            {warnings.length > 0 ? (
              <details className="mx-4 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm" open>
                <summary className="cursor-pointer px-3 py-2 font-medium">
                  {warnings.length} cảnh báo trong bài
                </summary>
                <ul className="px-3 pb-2">
                  {warnings.map((warning, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        className="w-full rounded px-1 py-0.5 text-left hover:bg-amber-500/15"
                        onClick={() => warning.line && view && goToLine(view, warning.line)}
                      >
                        {warning.line ? <span className="font-mono text-xs">Dòng {warning.line}: </span> : null}
                        {warning.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="mx-auto max-w-3xl px-6 py-6">
              <DocContent html={preview.html} />
            </div>
          </div>
        ) : null}
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        warningCount={warnings.length}
        onPublish={publish}
      />
      <RevisionsSheet
        docId={doc.id}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        canRestore={!readOnly}
        beforeRestore={() => persist({ createRevision: true, message: 'Lưu tự động trước khi khôi phục' })}
        onRestored={(restored, result) => {
          savedRef.current = restored;
          latestRef.current = restored;
          baseRef.current = result.doc.sourceUpdatedAt;
          setSource(restored);
          applySummary(result.doc);
          setSaveState({ kind: 'saved', at: new Date() });
        }}
      />
    </div>
  );
}

function SaveIndicator({
  state,
  onRetry,
  onGoToLine,
}: {
  state: SaveState;
  onRetry: () => void;
  onGoToLine: (line: number) => void;
}) {
  const base = 'flex items-center gap-1 text-xs whitespace-nowrap';
  switch (state.kind) {
    case 'saving':
      return (
        <span className={cn(base, 'text-muted-foreground')}>
          <Loader2Icon className="size-3.5 animate-spin" /> Đang lưu…
        </span>
      );
    case 'dirty':
      return <span className={cn(base, 'text-muted-foreground')}>Chưa lưu</span>;
    case 'saved':
      return (
        <span className={cn(base, 'text-muted-foreground')} title="Bản nháp đã lưu trên máy chủ">
          <CheckIcon className="size-3.5" /> Đã lưu{' '}
          {state.at.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      );
    case 'conflict':
      return <span className={cn(base, 'text-destructive')}>Xung đột chỉnh sửa</span>;
    case 'error':
      return (
        <span className={cn(base, 'max-w-72 text-destructive')} title={state.message}>
          <AlertCircleIcon className="size-3.5 shrink-0" />
          <span className="truncate">{state.message}</span>
          {state.line ? (
            <button type="button" className="underline" onClick={() => onGoToLine(state.line!)}>
              dòng {state.line}
            </button>
          ) : (
            <button type="button" className="underline" onClick={onRetry}>
              thử lại
            </button>
          )}
        </span>
      );
  }
}

function Banner({
  icon: Icon,
  tone = 'warning',
  action,
  secondary,
  children,
}: {
  icon: typeof LockIcon;
  tone?: 'warning' | 'danger';
  action?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm',
        tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-amber-500/10',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {secondary ? (
        <Button variant="ghost" size="xs" onClick={secondary.onClick}>
          {secondary.label}
        </Button>
      ) : null}
      {action ? (
        <Button variant="outline" size="xs" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
