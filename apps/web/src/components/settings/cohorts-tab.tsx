'use client';

import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog, FormDialog } from '@/components/form-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { Cohort, VersionItem } from '@/lib/api-types';
import { clientApi, jsonBody } from '@/lib/client-api';
import { formatDate, useAction } from './use-action';

type Editing = { mode: 'create' } | { mode: 'edit'; cohort: Cohort };

/** Lớp học: nhóm học viên theo khoá tuyển sinh, mỗi lớp đọc một phiên bản tài liệu. */
export function CohortsTab({
  courseId,
  cohorts,
  versions,
}: {
  courseId: string;
  cohorts: Cohort[];
  versions: VersionItem[];
}) {
  const { refresh } = useAction();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<Cohort | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Lớp học</CardTitle>
          <CardDescription className="mt-1.5">
            Học viên trong lớp mặc định đọc phiên bản được gán cho lớp; không gán thì đọc phiên bản hiện hành.
          </CardDescription>
        </div>
        <Button onClick={() => setEditing({ mode: 'create' })}>
          <PlusIcon /> Lớp mới
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {cohorts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Chưa có lớp nào. Tạo lớp để gán học viên vào đúng phiên bản tài liệu.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Lớp</th>
                <th className="py-2 pr-3 font-medium">Phiên bản</th>
                <th className="py-2 pr-3 font-medium">Thời gian</th>
                <th className="py-2 pr-3 font-medium">Học viên</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort) => (
                <tr key={cohort.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{cohort.name}</td>
                  <td className="py-2 pr-3">{cohort.version?.label ?? <span className="text-muted-foreground">Hiện hành</span>}</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(cohort.startAt)} – {formatDate(cohort.endAt)}
                  </td>
                  <td className="py-2 pr-3">{cohort._count.members}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" aria-label={`Sửa lớp ${cohort.name}`} onClick={() => setEditing({ mode: 'edit', cohort })}>
                      <PencilIcon />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Xoá lớp ${cohort.name}`} onClick={() => setRemoving(cohort)}>
                      <Trash2Icon />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>

      {editing ? (
        <FormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          title={editing.mode === 'create' ? 'Lớp học mới' : `Sửa lớp ${editing.cohort.name}`}
          submitLabel={editing.mode === 'create' ? 'Tạo lớp' : 'Lưu'}
          onSubmit={async (form) => {
            const body = {
              name: String(form.get('name')).trim(),
              versionId: String(form.get('versionId')) || null,
              startAt: String(form.get('startAt')) || null,
              endAt: String(form.get('endAt')) || null,
            };
            if (editing.mode === 'create') {
              await clientApi(`/courses/${courseId}/cohorts`, {
                method: 'POST',
                ...jsonBody({
                  name: body.name,
                  versionId: body.versionId ?? undefined,
                  startAt: body.startAt ?? undefined,
                  endAt: body.endAt ?? undefined,
                }),
              });
            } else {
              await clientApi(`/cohorts/${editing.cohort.id}`, { method: 'PATCH', ...jsonBody(body) });
            }
            refresh();
          }}
        >
          <CohortFields cohort={editing.mode === 'edit' ? editing.cohort : undefined} versions={versions} />
        </FormDialog>
      ) : null}

      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Xoá lớp ${removing.name}?`}
          description={`${removing._count.members} học viên trong lớp vẫn ở lại khoá học, chỉ không còn thuộc lớp nào.`}
          confirmLabel="Xoá lớp"
          destructive
          onConfirm={async () => {
            await clientApi(`/cohorts/${removing.id}`, { method: 'DELETE' });
            refresh();
          }}
        />
      ) : null}
    </Card>
  );
}

function CohortFields({ cohort, versions }: { cohort?: Cohort; versions: VersionItem[] }) {
  const dateValue = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="name">Tên lớp</Label>
        <Input id="name" name="name" required maxLength={100} defaultValue={cohort?.name} placeholder="Ví dụ: K2026-A" autoFocus />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="versionId">Phiên bản tài liệu</Label>
        <NativeSelect id="versionId" name="versionId" defaultValue={cohort?.versionId ?? ''}>
          <option value="">Theo phiên bản hiện hành</option>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
              {v.isCurrent ? ' (hiện hành)' : ''}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="startAt">Bắt đầu</Label>
          <Input id="startAt" name="startAt" type="date" defaultValue={dateValue(cohort?.startAt)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="endAt">Kết thúc</Label>
          <Input id="endAt" name="endAt" type="date" defaultValue={dateValue(cohort?.endAt)} />
        </div>
      </div>
    </>
  );
}
