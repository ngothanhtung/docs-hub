'use client';

import { LockIcon, LockOpenIcon, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConfirmDialog, FormDialog } from '@/components/form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { VersionItem } from '@/lib/api-types';
import { clientApi, jsonBody } from '@/lib/client-api';
import { formatDate, useAction } from './use-action';

/**
 * Phiên bản tài liệu: mỗi đợt học dùng một bản. "Cắt" phiên bản mới = sao chép toàn bộ bài
 * của bản cũ, rồi sửa trên bản mới mà không ảnh hưởng lớp đang học bản cũ.
 */
export function VersionsTab({
  courseId,
  courseSlug,
  versions,
}: {
  courseId: string;
  courseSlug: string;
  versions: VersionItem[];
}) {
  const { run, pending, refresh } = useAction();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<VersionItem | null>(null);
  const [removing, setRemoving] = useState<VersionItem | null>(null);
  const current = versions.find((v) => v.isCurrent);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Phiên bản</CardTitle>
          <CardDescription className="mt-1.5">
            Phiên bản hiện hành là bản học viên đọc khi không thuộc lớp nào. Khoá phiên bản khi khoá học kết thúc để
            không ai sửa nhầm.
          </CardDescription>
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon /> Phiên bản mới
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {versions.map((version) => {
          const busy = pending?.endsWith(version.id) ?? false;
          return (
            <div key={version.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{version.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">/{version.slug}</span>
                  {version.isCurrent ? <Badge>Hiện hành</Badge> : null}
                  {version.frozenAt ? (
                    <Badge variant="outline" className="gap-1">
                      <LockIcon className="size-3" /> Đã khoá
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {version._count.docs} bài · {version._count.cohorts} lớp · tạo {formatDate(version.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Link href={`/studio/${courseSlug}/${version.slug}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                  Mở Studio
                </Link>
                {version.isCurrent ? null : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      run(`current-${version.id}`, () => clientApi(`/versions/${version.id}/make-current`, { method: 'POST' }), `"${version.label}" là phiên bản hiện hành`)
                    }
                  >
                    <StarIcon /> Đặt hiện hành
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      `freeze-${version.id}`,
                      () => clientApi(`/versions/${version.id}`, { method: 'PATCH', ...jsonBody({ frozen: !version.frozenAt }) }),
                      version.frozenAt ? `Đã mở khoá "${version.label}"` : `Đã khoá "${version.label}"`,
                    )
                  }
                >
                  {version.frozenAt ? <LockOpenIcon /> : <LockIcon />}
                  {version.frozenAt ? 'Mở khoá' : 'Khoá'}
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label={`Đổi tên ${version.label}`} onClick={() => setRenaming(version)}>
                  <PencilIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Xoá ${version.label}`}
                  disabled={version.isCurrent}
                  title={version.isCurrent ? 'Không xoá được phiên bản hiện hành' : undefined}
                  onClick={() => setRemoving(version)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>

      <FormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Phiên bản mới"
        description="Chọn phiên bản nguồn để sao chép toàn bộ nhóm bài, bài viết, bản nháp và bản đã xuất bản."
        submitLabel="Tạo phiên bản"
        onSubmit={async (form) => {
          await clientApi(`/courses/${courseId}/versions`, {
            method: 'POST',
            ...jsonBody({
              label: String(form.get('label')).trim(),
              copyFromVersionId: String(form.get('copyFrom')) || undefined,
              makeCurrent: form.get('makeCurrent') === 'on',
            }),
          });
          refresh();
        }}
      >
        <div className="grid gap-2">
          <Label htmlFor="label">Tên phiên bản</Label>
          <Input id="label" name="label" required maxLength={50} placeholder={String(new Date().getFullYear() + 1)} autoFocus />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="copyFrom">Sao chép nội dung từ</Label>
          <NativeSelect id="copyFrom" name="copyFrom" defaultValue={current?.id ?? ''}>
            <option value="">Không sao chép (phiên bản trống)</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label} ({v._count.docs} bài)
              </option>
            ))}
          </NativeSelect>
        </div>
        <Label className="flex items-center gap-2 font-normal">
          <input type="checkbox" name="makeCurrent" className="size-4 accent-primary" />
          Đặt làm phiên bản hiện hành ngay
        </Label>
      </FormDialog>

      {renaming ? (
        <FormDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          title={`Đổi tên "${renaming.label}"`}
          description="Chỉ đổi tên hiển thị; đường dẫn của phiên bản giữ nguyên để link cũ vẫn dùng được."
          submitLabel="Lưu"
          onSubmit={async (form) => {
            await clientApi(`/versions/${renaming.id}`, {
              method: 'PATCH',
              ...jsonBody({ label: String(form.get('label')).trim() }),
            });
            refresh();
          }}
        >
          <Input name="label" required maxLength={50} defaultValue={renaming.label} aria-label="Tên phiên bản" autoFocus />
        </FormDialog>
      ) : null}

      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Xoá phiên bản "${removing.label}"?`}
          description={`Toàn bộ ${removing._count.docs} bài và lịch sử của phiên bản này sẽ bị xoá, không khôi phục được.`}
          confirmLabel="Xoá vĩnh viễn"
          destructive
          onConfirm={async () => {
            await clientApi(`/versions/${removing.id}`, { method: 'DELETE' });
            refresh();
          }}
        />
      ) : null}
    </Card>
  );
}
