'use client';

import { Loader2Icon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/admin-format';
import type { AuditEntry } from '@/lib/api-types';
import { clientApi } from '@/lib/client-api';

const PAGE = 100;

export const ACTION_LABEL: Record<string, string> = {
  'settings.update': 'Cấu hình',
  'user.role': 'Đổi vai trò',
  'user.activate': 'Mở khoá',
  'user.deactivate': 'Khoá tài khoản',
  'course.archive': 'Lưu trữ khoá',
  'course.unarchive': 'Khôi phục khoá',
  'course.delete': 'Xoá khoá',
  'course.transfer': 'Chuyển chủ khoá',
  'search.reindex': 'Lập chỉ mục',
};

const FILTERS = [
  { value: '', label: 'Tất cả thao tác' },
  { value: 'settings', label: 'Cấu hình hệ thống' },
  { value: 'user', label: 'Người dùng' },
  { value: 'course', label: 'Khoá học' },
  { value: 'search', label: 'Tìm kiếm' },
];

export function AuditLog({ entries: initial, action }: { entries: AuditEntry[]; action: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState(initial);
  const [more, setMore] = useState(initial.length === PAGE);
  const [loading, setLoading] = useState(false);

  const loadMore = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE), before: entries.at(-1)!.id, ...(action ? { action } : {}) });
      const next = await clientApi<AuditEntry[]>(`/admin/audit?${params}`);
      setEntries((list) => [...list, ...next]);
      setMore(next.length === PAGE);
    } catch {
      toast.error('Không tải được thêm nhật ký');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label="Lọc thao tác"
          value={action}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams);
            if (e.target.value) params.set('action', e.target.value);
            else params.delete('action');
            router.push(`${pathname}?${params}`);
          }}
          className="w-56"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </NativeSelect>
        <span className="text-sm text-muted-foreground">{entries.length} mục</span>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-44">Thời gian</TableHead>
              <TableHead className="w-56">Người thực hiện</TableHead>
              <TableHead className="w-40">Thao tác</TableHead>
              <TableHead>Nội dung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Chưa có thao tác quản trị nào được ghi lại.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell title={formatDate(entry.at, true)} className="text-muted-foreground">
                    {formatRelative(entry.at)}
                  </TableCell>
                  <TableCell>
                    {entry.actor ? (
                      <div className="min-w-0">
                        <div className="truncate">{entry.actor.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{entry.actor.email}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Tài khoản đã xoá</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-muted-foreground">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal">{entry.summary}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {more ? (
        <Button variant="outline" className="self-center" disabled={loading} onClick={loadMore}>
          {loading ? <Loader2Icon className="animate-spin" /> : null} Tải thêm
        </Button>
      ) : null}
    </div>
  );
}
