'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  CopyIcon,
  DownloadIcon,
  EllipsisVerticalIcon,
  GraduationCapIcon,
  LockIcon,
  ShieldIcon,
  UnlockIcon,
  UserIcon,
  UserCogIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/form-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate, formatRelative, initials, ROLE_LABEL } from '@/lib/admin-format';
import type { AdminUser, SystemRole } from '@/lib/api-types';
import { ClientApiError, clientApi, jsonBody } from '@/lib/client-api';
import { DataTable, SortHeader } from './data-table';

const ROLE_ICON = { ADMIN: ShieldIcon, INSTRUCTOR: GraduationCapIcon, USER: UserIcon } as const;
const ROLES: SystemRole[] = ['ADMIN', 'INSTRUCTOR', 'USER'];

type Patch = { systemRole?: SystemRole; isActive?: boolean };

export function UsersTable({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  const router = useRouter();
  const [confirmLock, setConfirmLock] = useState<AdminUser[] | null>(null);

  /** Cập nhật tuần tự, báo số thành công/lỗi (ví dụ không được tự khoá chính mình). */
  const update = async (targets: AdminUser[], patch: Patch, success: string) => {
    let ok = 0;
    const errors: string[] = [];
    for (const user of targets) {
      try {
        await clientApi(`/users/${user.id}`, { method: 'PATCH', ...jsonBody(patch) });
        ok += 1;
      } catch (error) {
        errors.push(`${user.email}: ${error instanceof ClientApiError ? error.message : 'lỗi'}`);
      }
    }
    if (ok) toast.success(targets.length === 1 ? success : `${success}: ${ok}/${targets.length} tài khoản`);
    if (errors.length) toast.error(errors.slice(0, 3).join('\n'));
    router.refresh();
  };

  const columns = useMemo<ColumnDef<AdminUser, unknown>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (u) => u.name,
        header: ({ column }) => <SortHeader column={column} title="Người dùng" />,
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-2">
              <Avatar className="size-8">
                {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  {u.name}
                  {u.id === currentUserId ? <Badge variant="secondary">Bạn</Badge> : null}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {u.hasGoogle ? ' · Google' : ''}
                </div>
              </div>
            </div>
          );
        },
        enableHiding: false,
      },
      {
        id: 'role',
        accessorFn: (u) => u.systemRole,
        header: ({ column }) => <SortHeader column={column} title="Vai trò" />,
        cell: ({ row }) => {
          const Icon = ROLE_ICON[row.original.systemRole];
          return (
            <Badge variant="outline" className="px-1.5 text-muted-foreground">
              <Icon /> {ROLE_LABEL[row.original.systemRole]}
            </Badge>
          );
        },
      },
      {
        id: 'status',
        accessorFn: (u) => (u.isActive ? 1 : 0),
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            <span
              aria-hidden
              className={row.original.isActive ? 'size-2 rounded-full bg-emerald-500' : 'size-2 rounded-full bg-destructive'}
            />
            {row.original.isActive ? 'Hoạt động' : 'Đã khoá'}
          </Badge>
        ),
      },
      {
        id: 'courses',
        accessorFn: (u) => u.courses,
        header: ({ column }) => <SortHeader column={column} title="Khoá học" />,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.courses}
            {row.original.ownedCourses ? (
              <span className="text-muted-foreground"> · sở hữu {row.original.ownedCourses}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'lastLogin',
        accessorFn: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : 0),
        header: ({ column }) => <SortHeader column={column} title="Đăng nhập gần nhất" />,
        cell: ({ row }) => <span className="text-muted-foreground">{formatRelative(row.original.lastLoginAt)}</span>,
      },
      {
        id: 'createdAt',
        accessorFn: (u) => new Date(u.createdAt).getTime(),
        header: ({ column }) => <SortHeader column={column} title="Ngày tạo" />,
        cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => {
          const u = row.original;
          const self = u.id === currentUserId;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="flex size-8 text-muted-foreground data-open:bg-muted" />}
              >
                <EllipsisVerticalIcon />
                <span className="sr-only">Thao tác với {u.email}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{u.email}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={self}>
                    <UserCogIcon /> Đổi vai trò
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={u.systemRole}
                      onValueChange={(value) =>
                        void update([u], { systemRole: value as SystemRole }, `Đã đổi vai trò thành ${ROLE_LABEL[value as SystemRole]}`)
                      }
                    >
                      {ROLES.map((role) => (
                        <DropdownMenuRadioItem key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem
                  onClick={async () => {
                    await navigator.clipboard.writeText(u.email);
                    toast.success('Đã sao chép email');
                  }}
                >
                  <CopyIcon /> Sao chép email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {u.isActive ? (
                  <DropdownMenuItem variant="destructive" disabled={self} onClick={() => setConfirmLock([u])}>
                    <LockIcon /> Khoá tài khoản
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => void update([u], { isActive: true }, 'Đã mở khoá tài khoản')}>
                    <UnlockIcon /> Mở khoá
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [currentUserId],
  );

  const exportCsv = () => {
    const escape = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
    const lines = [
      ['Tên', 'Email', 'Vai trò', 'Trạng thái', 'Số khoá học', 'Đăng nhập gần nhất', 'Ngày tạo'],
      ...users.map((u) => [
        u.name,
        u.email,
        ROLE_LABEL[u.systemRole],
        u.isActive ? 'Hoạt động' : 'Đã khoá',
        u.courses,
        u.lastLoginAt ?? '',
        u.createdAt,
      ]),
    ].map((row) => row.map(escape).join(','));
    const url = URL.createObjectURL(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'nguoi-dung.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <DataTable
        data={users}
        columns={columns}
        getRowId={(u) => u.id}
        views={[
          { value: 'all', label: 'Tất cả', filter: () => true },
          { value: 'admin', label: 'Quản trị viên', filter: (u) => u.systemRole === 'ADMIN' },
          { value: 'instructor', label: 'Giảng viên', filter: (u) => u.systemRole === 'INSTRUCTOR' },
          { value: 'user', label: 'Học viên', filter: (u) => u.systemRole === 'USER' },
          { value: 'locked', label: 'Đã khoá', filter: (u) => !u.isActive },
        ]}
        search={{
          placeholder: 'Tìm theo tên hoặc email',
          match: (u, q) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        }}
        columnLabels={{ role: 'Vai trò', status: 'Trạng thái', courses: 'Khoá học', lastLogin: 'Đăng nhập gần nhất', createdAt: 'Ngày tạo' }}
        initialSorting={[{ id: 'createdAt', desc: true }]}
        toolbar={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <DownloadIcon /> <span className="hidden lg:inline">Xuất CSV</span>
          </Button>
        }
        bulkActions={(rows, clear) => (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <UserCogIcon /> Đặt vai trò
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {ROLES.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={async () => {
                      await update(rows, { systemRole: role }, `Đã đặt vai trò ${ROLE_LABEL[role]}`);
                      clear();
                    }}
                  >
                    {ROLE_LABEL[role]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => setConfirmLock(rows)}>
              <LockIcon /> Khoá
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await update(rows, { isActive: true }, 'Đã mở khoá');
                clear();
              }}
            >
              <UnlockIcon /> Mở khoá
            </Button>
          </>
        )}
      />
      <ConfirmDialog
        open={confirmLock !== null}
        onOpenChange={(open) => !open && setConfirmLock(null)}
        title={confirmLock?.length === 1 ? `Khoá tài khoản ${confirmLock[0].email}?` : `Khoá ${confirmLock?.length ?? 0} tài khoản?`}
        description="Người bị khoá bị đăng xuất ngay trên mọi thiết bị và không đăng nhập lại được cho tới khi mở khoá."
        confirmLabel="Khoá tài khoản"
        destructive
        onConfirm={async () => {
          if (confirmLock) await update(confirmLock, { isActive: false }, 'Đã khoá tài khoản');
        }}
      />
    </>
  );
}
