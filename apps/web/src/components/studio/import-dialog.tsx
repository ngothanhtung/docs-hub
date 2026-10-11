'use client';

import {
  FileArchiveIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  Loader2Icon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, type DragEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { ClientApiError, clientApi } from '@/lib/client-api';
import { cn } from '@/lib/utils';

/** Giống giới hạn của API (50 MB mỗi lần gửi). */
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ACCEPT = '.zip,.md,.mdx,.json,.yml,.yaml,.png,.jpg,.jpeg,.gif,.webp,.avif,.svg';

interface ImportWarning {
  message: string;
  line: number | null;
}

interface TreeItem {
  type: 'category' | 'doc';
  label: string;
  slug: string;
  path: string;
  source?: string;
  warnings?: number;
  children?: TreeItem[];
}

interface ImportReport {
  dryRun: boolean;
  format: 'docusaurus' | 'mintlify';
  wrapper: { label: string; slug: string } | null;
  summary: { categories: number; docs: number; images: number; warnings: number };
  tree: TreeItem[];
  docs: { source: string; path: string; title: string; warnings: ImportWarning[] }[];
  skipped: { path: string; reason: string }[];
  warnings: ImportWarning[];
  created: { categories: number; docs: number; published: number; firstDocId: string | null } | null;
}

/** File kèm đường dẫn tương đối (khi chọn cả thư mục). */
interface PickedFile {
  file: File;
  path: string;
}

const FORMAT_LABEL = { docusaurus: 'Docusaurus', mintlify: 'Mintlify' } as const;

/**
 * Nhập tài liệu từ Docusaurus hoặc Mintlify: chọn .zip / thư mục / file, xem trước cây bài
 * và cảnh báo chuyển đổi, rồi mới ghi. Bài nhập vào là bản nháp, chủ khoá có thể xuất bản luôn.
 */
export function ImportDialog({
  open,
  onOpenChange,
  versionId,
  courseSlug,
  versionSlug,
  isOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: string;
  courseSlug: string;
  versionSlug: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [format, setFormat] = useState<'auto' | 'docusaurus' | 'mintlify'>('auto');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [publish, setPublish] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null);
  const [dragging, setDragging] = useState(false);

  const totalBytes = files.reduce((n, f) => n + f.file.size, 0);
  const tooLarge = totalBytes > MAX_UPLOAD_BYTES;

  const reset = () => {
    setFiles([]);
    setReport(null);
    setCategoryLabel('');
    setPublish(false);
    setFormat('auto');
  };

  const pick = (list: FileList | File[]) => {
    const picked = [...list].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
    setFiles(picked);
    setReport(null);
  };

  const send = async (dryRun: boolean) => {
    const form = new FormData();
    for (const { file, path } of files) form.append('files', file, path);
    form.append('format', format);
    form.append('dryRun', String(dryRun));
    form.append('publish', String(publish && isOwner));
    if (categoryLabel.trim()) form.append('categoryLabel', categoryLabel.trim());
    setBusy(dryRun ? 'preview' : 'import');
    try {
      const result = await clientApi<ImportReport>(`/versions/${versionId}/import`, { method: 'POST', body: form });
      setReport(result);
      if (!dryRun && result.created) {
        const { categories, docs, published } = result.created;
        toast.success(
          `Đã nhập ${docs} bài, ${categories} nhóm${published ? `, xuất bản ${published} bài` : ' (bản nháp)'}`,
        );
        onOpenChange(false);
        reset();
        router.refresh();
        if (result.created.firstDocId) {
          router.push(`/studio/${courseSlug}/${versionSlug}/docs/${result.created.firstDocId}`);
        }
      }
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Không gửi được file, vui lòng thử lại');
    } finally {
      setBusy(null);
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) pick(event.dataTransfer.files);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nhập tài liệu từ Docusaurus hoặc Mintlify</DialogTitle>
          <DialogDescription>
            Chọn file .zip của cả dự án (hoặc thư mục docs/), cả thư mục, hoặc vài file .md/.mdx. Bài được nhập vào
            phiên bản đang mở; component MDX được chuyển sang cú pháp của DocsHub.
          </DialogDescription>
        </DialogHeader>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm',
            dragging && 'border-primary bg-primary/5',
          )}
        >
          <UploadIcon className="size-6 text-muted-foreground" />
          {files.length === 0 ? (
            <p className="text-muted-foreground">Kéo thả file .zip hoặc file .md/.mdx vào đây</p>
          ) : (
            <p>
              <span className="font-medium">
                {files.length === 1 ? files[0].path : `${files.length} file`}
              </span>{' '}
              <span className="text-muted-foreground">({formatBytes(totalBytes)})</span>
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <FileArchiveIcon /> Chọn .zip / file
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => folderInput.current?.click()}>
              <FolderOpenIcon /> Chọn thư mục
            </Button>
          </div>
          {tooLarge ? (
            <p className="text-xs text-destructive">Tổng dung lượng vượt 50 MB. Hãy bỏ bớt ảnh hoặc chia làm nhiều lần.</p>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && pick(e.target.files)}
          />
          <input
            ref={folderInput}
            type="file"
            multiple
            className="hidden"
            // Thuộc tính chuẩn của trình duyệt để chọn cả thư mục (giữ đường dẫn tương đối).
            {...{ webkitdirectory: '' }}
            onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && pick(e.target.files)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="import-format">Nguồn</Label>
            <NativeSelect
              id="import-format"
              value={format}
              onChange={(e) => {
                setFormat(e.target.value as typeof format);
                setReport(null);
              }}
            >
              <option value="auto">Tự nhận diện</option>
              <option value="docusaurus">Docusaurus / thư mục Markdown</option>
              <option value="mintlify">Mintlify</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="import-category">Đặt vào nhóm mới (tuỳ chọn)</Label>
            <Input
              id="import-category"
              value={categoryLabel}
              maxLength={120}
              placeholder="Bỏ trống = nhập vào gốc"
              onChange={(e) => {
                setCategoryLabel(e.target.value);
                setReport(null);
              }}
            />
          </div>
        </div>
        {isOwner ? (
          <Label className="flex items-start gap-2 font-normal">
            <Checkbox checked={publish} onCheckedChange={(checked) => setPublish(checked === true)} className="mt-0.5" />
            <span>
              Xuất bản luôn
              <span className="block text-xs text-muted-foreground">
                Bỏ chọn để nhập thành bản nháp, xem lại trong Studio rồi mới xuất bản.
              </span>
            </span>
          </Label>
        ) : null}

        {report ? <ReportView report={report} /> : null}

        <DialogFooter>
          <Button variant="outline" disabled={files.length === 0 || tooLarge || busy !== null} onClick={() => send(true)}>
            {busy === 'preview' ? <Loader2Icon className="animate-spin" /> : null} Xem trước
          </Button>
          <Button
            disabled={!report || files.length === 0 || tooLarge || busy !== null}
            onClick={() => send(false)}
            title={report ? undefined : 'Bấm "Xem trước" trước khi nhập'}
          >
            {busy === 'import' ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            {report ? `Nhập ${report.summary.docs} bài` : 'Nhập'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportView({ report }: { report: ImportReport }) {
  const { summary } = report;
  const docWarnings = report.docs.filter((d) => d.warnings.length > 0);
  return (
    <section aria-label="Kết quả xem trước" className="flex flex-col gap-3 rounded-lg border p-4 text-sm">
      <p>
        Nhận diện: <span className="font-medium">{FORMAT_LABEL[report.format]}</span> · {summary.docs} bài,{' '}
        {summary.categories} nhóm, {summary.images} ảnh
        {summary.warnings ? (
          <span className="text-muted-foreground"> · {summary.warnings} cảnh báo</span>
        ) : null}
      </p>
      <div className="max-h-64 overflow-y-auto rounded-md bg-muted/40 p-2">
        {report.wrapper ? (
          <TreeView items={[{ type: 'category', label: report.wrapper.label, slug: report.wrapper.slug, path: report.wrapper.slug, children: report.tree }]} />
        ) : (
          <TreeView items={report.tree} />
        )}
      </div>
      {report.warnings.length || docWarnings.length ? (
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
            <TriangleAlertIcon className="size-4 text-amber-500" /> Cảnh báo chuyển đổi
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {report.warnings.map((w, i) => (
              <li key={`p-${i}`} className="text-muted-foreground">
                {w.message}
              </li>
            ))}
            {docWarnings.map((doc) => (
              <li key={doc.source}>
                <span className="font-mono text-xs">{doc.source}</span>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {doc.warnings.map((w, i) => (
                    <li key={i}>
                      {w.line ? `Dòng ${w.line}: ` : ''}
                      {w.message}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {report.skipped.length ? (
        <details>
          <summary className="cursor-pointer font-medium">Bỏ qua {report.skipped.length} file</summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {report.skipped.map((s) => (
              <li key={s.path}>
                <span className="font-mono text-xs">{s.path}</span> — {s.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function TreeView({ items, depth = 0 }: { items: TreeItem[]; depth?: number }) {
  return (
    <ul className={cn('flex flex-col gap-0.5', depth > 0 && 'ml-4 border-l pl-2')}>
      {items.map((item) => (
        <li key={item.path}>
          <span className="flex items-center gap-1.5 py-0.5">
            {item.type === 'category' ? (
              <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className={cn('truncate', item.type === 'category' && 'font-medium')}>{item.label}</span>
            <span className="truncate font-mono text-xs text-muted-foreground">/{item.slug}</span>
            {item.warnings ? (
              <span className="ml-auto flex shrink-0 items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400">
                <TriangleAlertIcon className="size-3" /> {item.warnings}
              </span>
            ) : null}
          </span>
          {item.children?.length ? <TreeView items={item.children} depth={depth + 1} /> : null}
        </li>
      ))}
    </ul>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
