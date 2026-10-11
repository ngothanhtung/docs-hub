'use client';

import {
  CircleCheckIcon,
  CircleXIcon,
  DatabaseIcon,
  HardDriveIcon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
  ServerIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { formatDate, formatNumber } from '@/lib/admin-format';
import type { SystemStatus } from '@/lib/api-types';
import { ClientApiError, clientApi } from '@/lib/client-api';

function uptime(seconds: number) {
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d} ngày`, h && `${h} giờ`, `${m} phút`].filter(Boolean).join(' ');
}

function StatusCard({
  icon,
  title,
  ok,
  detail,
  error,
  children,
}: {
  icon: ReactNode;
  title: string;
  ok: boolean;
  detail: string;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 [&_svg]:size-4">
          {icon}
          {title}
        </CardDescription>
        <CardTitle className="text-xl">{ok ? 'Hoạt động' : 'Lỗi'}</CardTitle>
        <CardAction>
          <Badge variant="outline" className={ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
            {ok ? <CircleCheckIcon /> : <CircleXIcon />}
            {ok ? 'OK' : 'Lỗi'}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1 text-sm">
        <div className="text-muted-foreground">{detail}</div>
        {error ? <div className="line-clamp-2 text-destructive">{error}</div> : null}
        {children}
      </CardFooter>
    </Card>
  );
}

export function SystemStatusView({ status }: { status: SystemStatus }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const reindex = async () => {
    setReindexing(true);
    try {
      const result = await clientApi<{ versions: number }>('/admin/search/reindex', { method: 'POST' });
      toast.success(`Đã lập lại chỉ mục cho ${result.versions} phiên bản`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ClientApiError ? error.message : 'Lập chỉ mục thất bại');
    } finally {
      setReindexing(false);
    }
  };

  const rows: [string, number][] = [
    ['Người dùng', status.rows.users],
    ['Khoá học', status.rows.courses],
    ['Bài viết', status.rows.docs],
    ['Phiên bản lưu (revision)', status.rows.revisions],
    ['Ảnh', status.rows.assets],
    ['Sự kiện thống kê', status.rows.events],
  ];

  return (
    <div className="flex flex-col gap-4 px-4 md:gap-6 lg:px-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={refreshing} onClick={() => startRefresh(() => router.refresh())}>
          {refreshing ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Kiểm tra lại
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <StatusCard
          icon={<ServerIcon />}
          title="API (NestJS)"
          ok={status.api.ok}
          detail={`Node ${status.api.node} · ${status.api.env} · RAM ${status.api.memoryMb} MB`}
        >
          <div className="text-muted-foreground">
            Chạy {uptime(status.api.uptimeSec)} (từ {formatDate(status.api.startedAt, true)})
          </div>
        </StatusCard>
        <StatusCard
          icon={<DatabaseIcon />}
          title="PostgreSQL"
          ok={status.database.ok}
          detail={status.database.ok ? `Phản hồi ${status.database.latencyMs} ms` : 'Không kết nối được'}
          error={status.database.error}
        />
        <StatusCard
          icon={<SearchIcon />}
          title="Meilisearch"
          ok={status.search.ok}
          detail={
            status.search.ok
              ? `Chỉ mục ${status.search.index}: ${formatNumber(status.search.documents ?? 0)} mục${status.search.isIndexing ? ' · đang lập chỉ mục' : ''}`
              : `Chỉ mục ${status.search.index}`
          }
          error={status.search.error}
        />
        <StatusCard
          icon={<HardDriveIcon />}
          title="Lưu trữ ảnh (S3)"
          ok={status.storage.ok}
          detail={`Bucket ${status.storage.bucket}`}
          error={status.storage.error}
        />
      </div>
      <div className="grid gap-4 @3xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dữ liệu</CardTitle>
            <CardDescription>Số bản ghi trong cơ sở dữ liệu.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {rows.map(([label, count]) => (
                  <TableRow key={label}>
                    <TableCell>{label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tìm kiếm</CardTitle>
            <CardDescription>
              Chỉ mục được cập nhật tự động khi xuất bản, gỡ, sắp xếp bài. Lập lại toàn bộ khi kết quả tìm kiếm sai, sau khi
              khôi phục database hoặc đổi máy chủ Meilisearch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled={reindexing} onClick={() => setConfirm(true)}>
              {reindexing ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} Lập lại chỉ mục tìm kiếm
            </Button>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Lập lại toàn bộ chỉ mục tìm kiếm?"
        description="Mất từ vài giây tới vài phút tuỳ số bài. Trong lúc chạy, kết quả tìm kiếm có thể thiếu."
        confirmLabel="Lập lại chỉ mục"
        onConfirm={reindex}
      />
    </div>
  );
}
