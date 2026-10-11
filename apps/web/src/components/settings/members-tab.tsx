'use client';

import { Loader2Icon, SearchIcon, Trash2Icon, UserPlusIcon, UsersIcon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ConfirmDialog } from '@/components/form-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { Cohort, CourseMember, CourseRole, EnrollResult } from '@/lib/api-types';
import { clientApi, jsonBody } from '@/lib/client-api';
import { formatDate, useAction } from './use-action';

const ROLE_LABEL: Record<CourseRole, string> = {
  OWNER: 'Chủ khoá',
  EDITOR: 'Biên tập viên',
  LEARNER: 'Học viên',
};

export function MembersTab({
  courseId,
  ownerId,
  members,
  cohorts,
}: {
  courseId: string;
  ownerId: string;
  members: CourseMember[];
  cohorts: Cohort[];
}) {
  const { run, pending } = useAction();
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState<CourseMember | null>(null);
  const [enrollResult, setEnrollResult] = useState<EnrollResult | null>(null);

  const visible = members.filter((m) =>
    `${m.user.name} ${m.user.email}`.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const addMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const ok = await run(
      'add',
      () =>
        clientApi(`/courses/${courseId}/members`, {
          method: 'POST',
          ...jsonBody({
            email: String(form.get('email')).trim(),
            role: form.get('role'),
            cohortId: String(form.get('cohortId')) || undefined,
          }),
        }),
      'Đã thêm thành viên',
    );
    if (ok) formEl.reset();
  };

  const enroll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const emails = String(form.get('emails'))
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) return;
    await run(
      'enroll',
      async () => {
        const result = await clientApi<EnrollResult>(`/courses/${courseId}/members/enroll`, {
          method: 'POST',
          ...jsonBody({ emails, cohortId: String(form.get('cohortId')) || undefined }),
        });
        setEnrollResult(result);
        if (result.notFound.length === 0) formEl.reset();
        return result;
      },
      (result) => `Đã ghi danh ${result.enrolled.length} học viên`,
    );
  };

  const update = (member: CourseMember, data: { role?: CourseRole; cohortId?: string | null }) =>
    run(
      `update-${member.user.id}`,
      () => clientApi(`/courses/${courseId}/members/${member.user.id}`, { method: 'PATCH', ...jsonBody(data) }),
      `Đã cập nhật ${member.user.name}`,
    );

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlusIcon className="size-4" /> Thêm thành viên
            </CardTitle>
            <CardDescription>Người được thêm phải đã đăng ký tài khoản DocsHub bằng email này.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addMember} className="grid gap-3">
              <Input name="email" type="email" required placeholder="email@vi-du.vn" aria-label="Email" />
              <div className="grid grid-cols-2 gap-3">
                <NativeSelect name="role" defaultValue="EDITOR" aria-label="Vai trò">
                  <option value="EDITOR">Biên tập viên</option>
                  <option value="LEARNER">Học viên</option>
                  <option value="OWNER">Đồng chủ khoá</option>
                </NativeSelect>
                <CohortSelect cohorts={cohorts} />
              </div>
              <div>
                <Button type="submit" disabled={pending === 'add'}>
                  {pending === 'add' ? <Loader2Icon className="animate-spin" /> : null} Thêm
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-4" /> Ghi danh học viên hàng loạt
            </CardTitle>
            <CardDescription>Dán danh sách email, mỗi email một dòng hoặc cách nhau bằng dấu phẩy.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={enroll} className="grid gap-3">
              <Textarea name="emails" rows={3} required placeholder={'a@vi-du.vn\nb@vi-du.vn'} aria-label="Danh sách email" />
              <div className="flex gap-3">
                <CohortSelect cohorts={cohorts} className="flex-1" />
                <Button type="submit" disabled={pending === 'enroll'}>
                  {pending === 'enroll' ? <Loader2Icon className="animate-spin" /> : null} Ghi danh
                </Button>
              </div>
              {enrollResult ? <EnrollSummary result={enrollResult} /> : null}
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle>Thành viên ({members.length})</CardTitle>
          <div className="relative w-full max-w-xs">
            <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên hoặc email"
              className="pl-8"
              aria-label="Tìm thành viên"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Thành viên</th>
                <th className="py-2 pr-3 font-medium">Vai trò</th>
                <th className="py-2 pr-3 font-medium">Lớp</th>
                <th className="py-2 pr-3 font-medium">Tham gia</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => {
                const isPrimaryOwner = member.user.id === ownerId;
                const busy = pending === `update-${member.user.id}`;
                return (
                  <tr key={member.user.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{member.user.name}</div>
                      <div className="text-xs text-muted-foreground">{member.user.email}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {isPrimaryOwner ? (
                        <Badge variant="secondary">Chủ khoá chính</Badge>
                      ) : (
                        <NativeSelect
                          value={member.role}
                          disabled={busy}
                          aria-label={`Vai trò của ${member.user.name}`}
                          onChange={(e) => update(member, { role: e.target.value as CourseRole })}
                        >
                          {(Object.keys(ROLE_LABEL) as CourseRole[]).map((role) => (
                            <option key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </option>
                          ))}
                        </NativeSelect>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {member.role === 'LEARNER' ? (
                        <NativeSelect
                          value={member.cohort?.id ?? ''}
                          disabled={busy}
                          aria-label={`Lớp của ${member.user.name}`}
                          onChange={(e) => update(member, { cohortId: e.target.value || null })}
                        >
                          <option value="">Không thuộc lớp</option>
                          {cohorts.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{formatDate(member.createdAt)}</td>
                    <td className="py-2 text-right">
                      {isPrimaryOwner ? null : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Xoá ${member.user.name} khỏi khoá học`}
                          onClick={() => setRemoving(member)}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Không có thành viên phù hợp.</p>
          ) : null}
        </CardContent>
      </Card>

      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Xoá ${removing.user.name} khỏi khoá học?`}
          description="Người này sẽ không còn đọc hoặc soạn được tài liệu của khoá. Tiến độ học của họ vẫn được giữ."
          confirmLabel="Xoá khỏi khoá"
          destructive
          onConfirm={async () => {
            await run(
              `remove-${removing.user.id}`,
              () => clientApi(`/courses/${courseId}/members/${removing.user.id}`, { method: 'DELETE' }),
              `Đã xoá ${removing.user.name} khỏi khoá học`,
            );
          }}
        />
      ) : null}
    </div>
  );
}

function CohortSelect({ cohorts, className }: { cohorts: Cohort[]; className?: string }) {
  return (
    <NativeSelect name="cohortId" defaultValue="" aria-label="Lớp học" className={className}>
      <option value="">Không thuộc lớp</option>
      {cohorts.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function EnrollSummary({ result }: { result: EnrollResult }) {
  return (
    <Alert variant={result.notFound.length > 0 ? 'destructive' : 'default'}>
      <AlertDescription className="grid gap-1 text-sm">
        <span>Đã ghi danh {result.enrolled.length} học viên.</span>
        {result.alreadyMembers.length > 0 ? (
          <span>Đã là thành viên từ trước: {result.alreadyMembers.join(', ')}.</span>
        ) : null}
        {result.notFound.length > 0 ? (
          <span>
            Chưa có tài khoản (cần đăng ký trước): {result.notFound.join(', ')}.
          </span>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
