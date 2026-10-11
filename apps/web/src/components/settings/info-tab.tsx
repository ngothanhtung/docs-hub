'use client';

import { ArchiveIcon, ArchiveRestoreIcon, Loader2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CourseDetail } from '@/lib/api-types';
import { clientApi, jsonBody } from '@/lib/client-api';
import { useAction } from './use-action';

export function InfoTab({ course }: { course: CourseDetail }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [confirmArchive, setConfirmArchive] = useState(false);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const slug = String(form.get('slug')).trim();
    const ok = await run(
      'info',
      () =>
        clientApi(`/courses/${course.id}`, {
          method: 'PATCH',
          ...jsonBody({
            title: String(form.get('title')).trim(),
            description: String(form.get('description') ?? '').trim() || null,
            slug: slug !== course.slug ? slug : undefined,
          }),
        }),
      'Đã lưu thông tin khoá học',
    );
    // Đổi slug thì URL trang cài đặt cũng đổi.
    if (ok && slug !== course.slug) router.replace(`/studio/${slug}/settings`);
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin khoá học</CardTitle>
          <CardDescription>Tên và mô tả hiện ở trang chủ của học viên.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid max-w-xl gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Tên khoá học</Label>
              <Input id="title" name="title" required maxLength={200} defaultValue={course.title} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Mô tả</Label>
              <Textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={course.description ?? ''} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="slug">Đường dẫn (slug)</Label>
              <Input
                id="slug"
                name="slug"
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                title="Chữ thường không dấu, số và dấu gạch ngang"
                defaultValue={course.slug}
              />
              <p className="text-xs text-muted-foreground">
                Đổi slug làm link cũ tới khoá học (đã gửi cho học viên) không còn dùng được.
              </p>
            </div>
            <div>
              <Button type="submit" disabled={pending === 'info'}>
                {pending === 'info' ? <Loader2Icon className="animate-spin" /> : null}
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{course.archivedAt ? 'Khoá học đang lưu trữ' : 'Lưu trữ khoá học'}</CardTitle>
          <CardDescription>
            {course.archivedAt
              ? 'Học viên và biên tập viên không còn thấy khoá học. Bỏ lưu trữ để mở lại.'
              : 'Ẩn khoá học với học viên và biên tập viên khi khoá đã kết thúc. Nội dung vẫn được giữ nguyên.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {course.archivedAt ? (
            <Button
              variant="outline"
              disabled={pending === 'archive'}
              onClick={() =>
                run('archive', () => clientApi(`/courses/${course.id}/unarchive`, { method: 'POST' }), 'Đã mở lại khoá học')
              }
            >
              <ArchiveRestoreIcon /> Bỏ lưu trữ
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => setConfirmArchive(true)}>
              <ArchiveIcon /> Lưu trữ khoá học
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Lưu trữ "${course.title}"?`}
        description="Học viên và biên tập viên sẽ không vào được khoá học. Bạn có thể bỏ lưu trữ bất cứ lúc nào."
        confirmLabel="Lưu trữ"
        destructive
        onConfirm={async () => {
          await clientApi(`/courses/${course.id}/archive`, { method: 'POST' });
          router.refresh();
        }}
      />
    </div>
  );
}
