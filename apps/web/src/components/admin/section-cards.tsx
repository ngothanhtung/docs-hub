import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { AdminOverview, Kpi } from '@/lib/api-types';

const number = new Intl.NumberFormat('vi-VN');

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend === null) return <Badge variant="outline">Mới</Badge>;
  const Icon = trend > 0 ? TrendingUpIcon : trend < 0 ? TrendingDownIcon : MinusIcon;
  return (
    <Badge variant="outline">
      <Icon />
      {trend > 0 ? '+' : ''}
      {trend.toLocaleString('vi-VN')}%
    </Badge>
  );
}

function trendText(trend: number | null, up: string, down: string) {
  if (trend === null) return 'Kỳ trước chưa có số liệu';
  if (trend === 0) return 'Không đổi so với kỳ trước';
  return trend > 0 ? up : down;
}

function KpiCard({
  label,
  value,
  kpi,
  up,
  down,
  note,
}: {
  label: string;
  value: number;
  kpi: Pick<Kpi, 'trend'>;
  up: string;
  down: string;
  note: string;
}) {
  const Icon = kpi.trend !== null && kpi.trend < 0 ? TrendingDownIcon : TrendingUpIcon;
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{number.format(value)}</CardTitle>
        <CardAction>
          <TrendBadge trend={kpi.trend} />
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {trendText(kpi.trend, up, down)} {kpi.trend ? <Icon className="size-4" /> : null}
        </div>
        <div className="text-muted-foreground">{note}</div>
      </CardFooter>
    </Card>
  );
}

/** 4 chỉ số chính, so với cùng số ngày ngay trước đó (bố cục section-cards của dashboard-01). */
export function SectionCards({ data }: { data: AdminOverview }) {
  const { kpis, days } = data;
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <KpiCard
        label="Người dùng"
        value={kpis.users.total}
        kpi={kpis.users}
        up={`+${number.format(kpis.users.new)} tài khoản mới`}
        down={`${number.format(kpis.users.new)} tài khoản mới, ít hơn kỳ trước`}
        note={`Đăng ký mới trong ${days} ngày`}
      />
      <KpiCard
        label="Người học hoạt động"
        value={kpis.activeUsers.total}
        kpi={kpis.activeUsers}
        up="Nhiều người học hơn kỳ trước"
        down="Ít người học hơn kỳ trước"
        note={`Mở ít nhất một bài trong ${days} ngày`}
      />
      <KpiCard
        label="Lượt xem bài"
        value={kpis.views.total}
        kpi={kpis.views}
        up="Lượt đọc tăng"
        down="Lượt đọc giảm, cần chú ý"
        note={`Tổng lượt mở bài trong ${days} ngày`}
      />
      <KpiCard
        label="Lượt tìm kiếm"
        value={kpis.searches.total}
        kpi={kpis.searches}
        up="Tìm kiếm tăng"
        down="Tìm kiếm giảm"
        note={`${number.format(kpis.searches.misses)} lượt không có kết quả`}
      />
    </div>
  );
}
