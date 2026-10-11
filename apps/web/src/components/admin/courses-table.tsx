'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BookOpenIcon,
  ChartColumnIcon,
  EllipsisVerticalIcon,
  Loader2Icon,
  PenLineIcon,
  SettingsIcon,
  Trash2Icon,
  UserRoundCogIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate, formatNumber } from '@/lib/admin-format';
import type { AdminCourse, AdminUser } from '@/lib/api-types';
import { ClientApiError, clientApi, jsonBody } from '@/lib/client-api';
import { cn } from '@/lib/utils';
import { DataTable, SortHeader } from './data-table';

const errorMessage = (error: unknown) => (error instanceof ClientApiError ? error.message : 'Có lỗi xảy ra');

export function CoursesTable({ courses }: { courses: AdminCourse[] }) {
  const router = useRouter();
  const [transfer, setTransfer] = useState<AdminCourse | null>(null);
  const [remove, setRemove] = useState<AdminCourse | null>(null);

  const setArchived = async (targets: AdminCourse[], archived: boolean) => {
    let ok = 0;
    for (const course of targets) {
      try {
        await clientApi(`/courses/${course.id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' });
        ok += 1;
      } catch (error) {
        toast.error(`${course.title}: ${errorMessage(error)}`);
      }
    }
    if (ok) toast.success(`${archived ? 'Đã lưu trữ' : 'Đã khôi phục'} ${ok} khoá học`);
    router.refresh();
  };

  const columns = useMemo<ColumnDef<AdminCourse, unknown>[]>(
    () => [
      {
        id: 'title',
        accessorFn: (c) => c.title,
        header: ({ column }) => <SortHeader column={column} title="Khoá học" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <Link href={`/studio/${row.original.slug}`} className="font-medium hover:underline">
              {row.original.title}
            </Link>
            <div className="text-xs text-muted-foreground">/{row.original.slug}</div>
          </div>
        ),
        enableHiding: false,
      },
      {
        id: 'owner',
        accessorFn: (c) => c.owner.name,
        header: ({ column }) => <SortHeader column={column} title="Chủ khoá" />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate">{row.original.owner.name}</div>
            <div className="truncate text-xs text-muted-foreground">{row.original.owner.email}</div>
          </div>
        ),
      },
      {
        id: 'learners',
        accessorFn: (c) => c.learners,
        header: ({ column }) => <SortHeader column={column} title="Học viên" />,
        cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.learners)}</span>,
      },
      {
        id: 'docs',
        accessorFn: (c) => c.publishedDocs,
        header: ({ column }) => <SortHeader column={column} title="Bài xuất bản" />,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.publishedDocs}
            <span className="text-muted-foreground"> / {row.original.docs}</span>
          </span>
        ),
      },
      {
        id: 'views',
        accessorFn: (c) => c.views30d,
        header: ({ column }) => <SortHeader column={column} title="Lượt xem 30 ngày" />,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatNumber(row.original.views30d)}
            <span className="text-muted-foreground"> · {row.original.activeLearners30d} người</span>
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: (c) => (c.archivedAt ? 1 : 0),
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant="outline" className="px-1.5 text-muted-foreground">
            <span
              aria-hidden
              className={cn('size-2 rounded-full', row.original.archivedAt ? 'bg-muted-foreground' : 'bg-emerald-500')}
            />
            {row.original.archivedAt ? 'Đã lưu trữ' : 'Đang mở'}
          </Badge>
        ),
      },
      {
        id: 'createdAt',
        accessorFn: (c) => new Date(c.createdAt).getTime(),
        header: ({ column }) => <SortHeader column={column} title="Ngày tạo" />,
        cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Thao tác</span>,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="flex size-8 text-muted-foreground data-open:bg-muted" />}
              >
                <EllipsisVerticalIcon />
                <span className="sr-only">Thao tác với {c.title}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="truncate">{c.title}</DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuItem render={<Link href={`/courses/${c.slug}`} />}>
                  <BookOpenIcon /> Trang đọc
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={`/studio/${c.slug}`} />}>
                  <PenLineIcon /> Studio
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={`/studio/${c.slug}/settings`} />}>
                  <SettingsIcon /> Cài đặt khoá
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={`/studio/${c.slug}/analytics`} />}>
                  <ChartColumnIcon /> Thống kê
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTransfer(c)}>
                  <UserRoundCogIcon /> Chuyển chủ khoá…
                </DropdownMenuItem>
                {c.archivedAt ? (
                  <DropdownMenuItem onClick={() => void setArchived([c], false)}>
                    <ArchiveRestoreIcon /> Khôi phục
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => void setArchived([c], true)}>
                    <ArchiveIcon /> Lưu trữ
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setRemove(c)}>
                  <Trash2Icon /> Xoá vĩnh viễn…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        enableHiding: false,
        enableSorting: false,
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        data={courses}
        columns={columns}
        getRowId={(c) => c.id}
        views={[
          { value: 'all', label: 'Tất cả', filter: () => true },
          { value: 'active', label: 'Đang mở', filter: (c) => !c.archivedAt },
          { value: 'archived', label: 'Đã lưu trữ', filter: (c) => Boolean(c.archivedAt) },
          { value: 'empty', label: 'Chưa có bài', filter: (c) => c.publishedDocs === 0 },
        ]}
        search={{
          placeholder: 'Tìm theo tên, slug hoặc chủ khoá',
          match: (c, q) =>
            [c.title, c.slug, c.owner.name, c.owner.email].some((value) => value.toLowerCase().includes(q)),
        }}
        columnLabels={{
          owner: 'Chủ khoá',
          learners: 'Học viên',
          docs: 'Bài xuất bản',
          views: 'Lượt xem 30 ngày',
          status: 'Trạng thái',
          createdAt: 'Ngày tạo',
        }}
        initialSorting={[{ id: 'views', desc: true }]}
        bulkActions={(rows, clear) => (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await setArchived(rows.filter((r) => !r.archivedAt), true);
                clear();
              }}
            >
              <ArchiveIcon /> Lưu trữ
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await setArchived(rows.filter((r) => r.archivedAt), false);
                clear();
              }}
            >
              <ArchiveRestoreIcon /> Khôi phục
            </Button>
          </>
        )}
      />
      <TransferDialog course={transfer} onClose={() => setTransfer(null)} onDone={() => router.refresh()} />
      <DeleteDialog course={remove} onClose={() => setRemove(null)} onDone={() => router.refresh()} />
    </>
  );
}

/** Chọn người nhận quyền chủ khoá bằng cách tìm theo email/tên. Chủ cũ ở lại với vai trò biên tập. */
function TransferDialog({ course, onClose, onDone }: { course: AdminCourse | null; onClose: () => void; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminUser[]>([]);
  const [chosen, setChosen] = useState<AdminUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!course) {
      setQuery('');
      setResults([]);
      setChosen(null);
    }
  }, [course]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      clientApi<AdminUser[]>(`/users?q=${encodeURIComponent(q)}`)
        .then((users) => setResults(users.filter((u) => u.isActive && u.id !== course?.owner.id).slice(0, 8)))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, course]);

  const submit = async () => {
    if (!course || !chosen) return;
    setBusy(true);
    try {
      await clientApi(`/admin/courses/${course.id}/owner`, { method: 'PATCH', ...jsonBody({ userId: chosen.id }) });
      toast.success(`Đã chuyển "${course.title}" cho ${chosen.name}`);
      onClose();
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={course !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chuyển chủ khoá</DialogTitle>
          <DialogDescription>
            {course ? `"${course.title}" đang thuộc ${course.owner.name}. ` : ''}Chủ cũ vẫn ở lại khoá với vai trò biên tập.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="transfer-search">Người nhận</Label>
          <Input
            id="transfer-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setChosen(null);
            }}
            placeholder="Gõ email hoặc tên (ít nhất 2 ký tự)"
            autoComplete="off"
          />
          {results.length ? (
            <ul role="listbox" aria-label="Kết quả" className="max-h-56 overflow-y-auto rounded-md border p-1">
              {results.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={chosen?.id === u.id}
                    onClick={() => setChosen(u)}
                    className={cn(
                      'flex w-full flex-col rounded px-2 py-1.5 text-left text-sm hover:bg-muted',
                      chosen?.id === u.id && 'bg-primary/10',
                    )}
                  >
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!chosen || busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : null}
            {chosen ? `Chuyển cho ${chosen.name}` : 'Chuyển'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Xoá vĩnh viễn: phải gõ đúng slug để tránh bấm nhầm. */
function DeleteDialog({ course, onClose, onDone }: { course: AdminCourse | null; onClose: () => void; onDone: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setTyped(''), [course]);

  const submit = async () => {
    if (!course) return;
    setBusy(true);
    try {
      await clientApi(`/courses/${course.id}`, { method: 'DELETE' });
      toast.success(`Đã xoá "${course.title}"`);
      onClose();
      onDone();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={course !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xoá vĩnh viễn khoá học?</DialogTitle>
          <DialogDescription>
            Xoá toàn bộ bài, phiên bản, lịch sử, tiến độ học, ghi chú và thống kê của khoá. Không khôi phục được. Nếu chỉ
            muốn ẩn khoá, hãy dùng “Lưu trữ”.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="delete-confirm">
            Gõ <span className="font-mono font-semibold">{course?.slug}</span> để xác nhận
          </Label>
          <Input id="delete-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="destructive" onClick={submit} disabled={typed !== course?.slug || busy}>
            {busy ? <Loader2Icon className="animate-spin" /> : <Trash2Icon />} Xoá vĩnh viễn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
