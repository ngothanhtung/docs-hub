'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { NativeSelect } from '@/components/ui/native-select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { AdminOverview } from '@/lib/api-types';
import { cn } from '@/lib/utils';

const METRICS = {
  views: { label: 'Lượt xem', description: 'Số lần học viên mở bài' },
  activeUsers: { label: 'Người học', description: 'Số người mở ít nhất một bài trong ngày' },
  signups: { label: 'Đăng ký', description: 'Tài khoản mới tạo trong ngày' },
  searches: { label: 'Tìm kiếm', description: 'Số lượt tìm trong khoá học' },
} as const;
type Metric = keyof typeof METRICS;

const RANGES = [
  { value: '90', label: '3 tháng qua' },
  { value: '30', label: '30 ngày qua' },
  { value: '7', label: '7 ngày qua' },
];

const formatDay = (day: string) => {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
};

/**
 * Biểu đồ vùng theo ngày (giờ Việt Nam). Mỗi lúc một chỉ số, chọn bằng các ô phía trên
 * (các chỉ số khác đơn vị nên không vẽ chồng hai trục).
 */
export function ChartAreaInteractive({ data }: { data: AdminOverview }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [metric, setMetric] = useState<Metric>('views');
  const config = { [metric]: { label: METRICS[metric].label, color: 'var(--primary)' } } satisfies ChartConfig;
  const totals = Object.fromEntries(
    (Object.keys(METRICS) as Metric[]).map((key) => [key, data.daily.reduce((sum, d) => sum + d[key], 0)]),
  ) as Record<Metric, number>;

  const setRange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('days', value);
    router.push(`${pathname}?${next}`, { scroll: false });
  };

  return (
    <Card className="@container/card pt-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! @[640px]/card:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pt-4 pb-3 @[640px]/card:py-4">
          <CardTitle>Hoạt động theo ngày</CardTitle>
          <CardDescription>{METRICS[metric].description}</CardDescription>
          <div className="mt-2">
            <ToggleGroup
              multiple={false}
              value={[String(data.days)]}
              onValueChange={(value) => value[0] && setRange(value[0])}
              variant="outline"
              className="hidden *:data-[slot=toggle-group-item]:px-3! @[767px]/card:flex"
            >
              {RANGES.map((r) => (
                <ToggleGroupItem key={r.value} value={r.value}>
                  {r.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <NativeSelect
              aria-label="Khoảng thời gian"
              value={String(data.days)}
              onChange={(e) => setRange(e.target.value)}
              className="w-36 @[767px]/card:hidden"
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div role="tablist" aria-label="Chỉ số" className="flex">
          {(Object.keys(METRICS) as Metric[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={metric === key}
              onClick={() => setMetric(key)}
              className={cn(
                'relative flex min-w-24 flex-1 flex-col justify-center gap-1 border-t px-5 py-3 text-left even:border-l data-[active=true]:bg-muted/50 @[640px]/card:border-t-0 @[640px]/card:border-l @[640px]/card:px-6 @[640px]/card:py-4',
              )}
              data-active={metric === key}
            >
              <span className="text-xs whitespace-nowrap text-muted-foreground">{METRICS[key].label}</span>
              <span className="text-lg leading-none font-bold tabular-nums @[640px]/card:text-2xl">
                {totals[key].toLocaleString('vi-VN')}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
          <AreaChart data={data.daily} margin={{ left: 0, right: 8 }}>
            <defs>
              <linearGradient id="fillMetric" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={`var(--color-${metric})`} stopOpacity={0.6} />
                <stop offset="95%" stopColor={`var(--color-${metric})`} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={formatDay}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} indicator="dot" />}
            />
            <Area
              dataKey={metric}
              type="monotone"
              fill="url(#fillMetric)"
              stroke={`var(--color-${metric})`}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
