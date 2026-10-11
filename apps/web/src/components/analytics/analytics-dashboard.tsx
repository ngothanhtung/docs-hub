'use client';

import {
  BookOpenCheckIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  SearchXIcon,
  UsersIcon,
  ActivityIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import type { CourseAnalytics } from '@/lib/api-types';
import { cn } from '@/lib/utils';

/** Một chuỗi số liệu nên chỉ dùng một màu; xem --viz-series trong globals.css. */
const SERIES = 'var(--viz-series)';
const GRID = 'var(--viz-grid)';
const TICK = { fill: 'var(--muted-foreground)', fontSize: 12 };
const BAR_SIZE = 16;

const numberFormat = new Intl.NumberFormat('vi-VN');

type DailyPoint = CourseAnalytics['daily'][number];
type DocPoint = CourseAnalytics['docs'][number];
type BucketPoint = CourseAnalytics['distribution'][number];

function formatDay(day: string) {
  const [, month, date] = day.split('-');
  return `${date}/${month}`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} giây`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
}

export function AnalyticsDashboard({
  data,
  courseSlug,
  versions,
}: {
  data: CourseAnalytics;
  courseSlug: string;
  versions: { slug: string; label: string }[];
}) {
  const { overview } = data;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Thống kê học tập</h1>
          <p className="text-sm text-muted-foreground">
            Chỉ tính học viên. Tiến độ tính trên các bài đang hiển thị của phiên bản {data.version.label}.
          </p>
        </div>
        <Filters days={data.days} version={data.version.slug} versions={versions} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={<UsersIcon />} label="Học viên ghi danh" value={numberFormat.format(overview.learners)} />
        <StatTile
          icon={<ActivityIcon />}
          label={`Hoạt động ${data.days} ngày`}
          value={numberFormat.format(overview.activeLearners)}
          hint={
            overview.learners > 0
              ? `${Math.round((overview.activeLearners / overview.learners) * 100)}% học viên`
              : undefined
          }
        />
        <StatTile icon={<EyeIcon />} label={`Lượt xem ${data.days} ngày`} value={numberFormat.format(overview.views)} />
        <StatTile icon={<FileTextIcon />} label="Bài đã xuất bản" value={numberFormat.format(overview.publishedDocs)} />
        <StatTile icon={<BookOpenCheckIcon />} label="Hoàn thành trung bình" value={`${overview.avgCompletion}%`} />
      </div>

      <ChartCard
        title="Học viên hoạt động mỗi ngày"
        description="Số học viên mở ít nhất một bài trong ngày (giờ Việt Nam). Rê chuột để xem cả lượt xem."
        table={
          <SimpleTable
            head={['Ngày', 'Học viên hoạt động', 'Lượt xem']}
            rows={data.daily.map((d) => [formatDay(d.day), d.activeLearners, d.views])}
          />
        }
      >
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.daily} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatDay}
              tick={TICK}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={(props) => (
                <ChartTooltip<DailyPoint>
                  {...props}
                  title={(p) => formatDay(p.day)}
                  rows={(p) => [
                    ['Học viên hoạt động', p.activeLearners, true],
                    ['Lượt xem', p.views],
                  ]}
                />
              )}
            />
            <Line
              type="monotone"
              dataKey="activeLearners"
              name="Học viên hoạt động"
              stroke={SERIES}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: SERIES, stroke: 'var(--card)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Tỉ lệ hoàn thành theo bài"
          description="% học viên đã hoàn thành từng bài, theo thứ tự trên sidebar. Bài tụt mạnh là chỗ học viên bỏ dở."
          table={
            <SimpleTable
              head={['Bài', 'Hoàn thành', 'Tỉ lệ']}
              rows={data.docs.map((d) => [d.title, d.completed, `${d.completionRate}%`])}
            />
          }
        >
          {data.docs.length === 0 ? (
            <EmptyChart>Chưa có bài nào được xuất bản.</EmptyChart>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(120, data.docs.length * 32 + 32)}>
              <BarChart
                data={data.docs}
                layout="vertical"
                margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                barCategoryGap={8}
              >
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="title"
                  width={150}
                  tick={TICK}
                  tickFormatter={(v: string) => (v.length > 22 ? `${v.slice(0, 21)}…` : v)}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                  content={(props) => (
                    <ChartTooltip<DocPoint>
                      {...props}
                      title={(p) => p.title}
                      rows={(p) => [
                        ['Tỉ lệ hoàn thành', `${p.completionRate}%`, true],
                        ['Học viên hoàn thành', p.completed],
                        ['Lượt xem', p.views],
                      ]}
                    />
                  )}
                />
                <Bar
                  dataKey="completionRate"
                  fill={SERIES}
                  barSize={BAR_SIZE}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Phân bố tiến độ học viên"
          description="Số học viên theo % bài đã hoàn thành trong phiên bản."
          table={
            <SimpleTable head={['Tiến độ', 'Học viên']} rows={data.distribution.map((d) => [d.label, d.learners])} />
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.distribution} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                content={(props) => (
                  <ChartTooltip<BucketPoint>
                    {...props}
                    title={(p) => `Tiến độ ${p.label}`}
                    rows={(p) => [['Học viên', p.learners, true]]}
                  />
                )}
              />
              <Bar dataKey="learners" fill={SERIES} barSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <DocStatsTable data={data} courseSlug={courseSlug} />
      <SearchMisses misses={data.searchMisses} days={data.days} />
    </div>
  );
}

function Filters({
  days,
  version,
  versions,
}: {
  days: number;
  version: string;
  versions: { slug: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    router.push(`${pathname}?${next}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect aria-label="Khoảng thời gian" value={String(days)} onChange={(e) => update('days', e.target.value)}>
        <option value="7">7 ngày qua</option>
        <option value="30">30 ngày qua</option>
        <option value="90">90 ngày qua</option>
      </NativeSelect>
      <NativeSelect aria-label="Phiên bản" value={version} onChange={(e) => update('version', e.target.value)}>
        {versions.map((v) => (
          <option key={v.slug} value={v.slug}>
            Phiên bản {v.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function StatTile({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** Khung biểu đồ, có nút chuyển sang dạng bảng (đọc được bằng trình đọc màn hình và khi không phân biệt được màu). */
function ChartCard({
  title,
  description,
  table,
  children,
}: {
  title: string;
  description: string;
  table: ReactNode;
  children: ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 rounded-lg border p-0.5 text-xs" role="group" aria-label="Kiểu hiển thị">
          {(['chart', 'table'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={cn(
                'rounded-md px-2 py-1 text-muted-foreground transition-colors',
                view === mode && 'bg-muted font-medium text-foreground',
              )}
            >
              {mode === 'chart' ? 'Biểu đồ' : 'Bảng'}
            </button>
          ))}
        </div>
      </div>
      {view === 'chart' ? children : <div className="max-h-80 overflow-y-auto">{table}</div>}
    </section>
  );
}

function EmptyChart({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

type TooltipRow = [label: string, value: ReactNode, primary?: boolean];

function ChartTooltip<T>({
  active,
  payload,
  title,
  rows,
}: Pick<TooltipContentProps<number, string>, 'active' | 'payload'> & {
  title: (point: T) => string;
  rows: (point: T) => TooltipRow[];
}) {
  const point = payload?.[0]?.payload as T | undefined;
  if (!active || !point) return null;
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium">{title(point)}</p>
      {rows(point).map(([label, value, primary]) => (
        <p key={label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {primary ? <span className="size-2 rounded-full" style={{ background: SERIES }} /> : null}
            {label}
          </span>
          <span className="font-medium tabular-nums">{value}</span>
        </p>
      ))}
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-card">
        <tr className="border-b text-left text-xs text-muted-foreground">
          {head.map((h, i) => (
            <th key={h} className={cn('py-2 font-medium', i > 0 && 'text-right')}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-b last:border-0">
            {row.map((cell, i) => (
              <td key={i} className={cn('py-1.5', i > 0 && 'text-right tabular-nums')}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DocStatsTable({ data, courseSlug }: { data: CourseAnalytics; courseSlug: string }) {
  const exportCsv = () => {
    const head = ['Bài', 'Đường dẫn', 'Lượt xem', 'Hoàn thành', 'Tỉ lệ hoàn thành (%)', 'Thời gian đọc TB (giây)', 'Hữu ích', 'Chưa hữu ích'];
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [
      head,
      ...data.docs.map((d) => [d.title, d.path, d.views, d.completed, d.completionRate, d.avgTimeSec, d.helpful, d.notHelpful]),
    ].map((row) => row.map(escape).join(','));
    // BOM để Excel đọc đúng tiếng Việt.
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `thong-ke-${courseSlug}-${data.version.slug}-${data.days}ngay.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">Chi tiết từng bài</h2>
          <p className="text-sm text-muted-foreground">
            Lượt xem tính trong {data.days} ngày; hoàn thành và đánh giá tính từ trước tới nay.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={data.docs.length === 0}>
          <DownloadIcon /> Xuất CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Bài</th>
              <th className="py-2 text-right font-medium">Lượt xem</th>
              <th className="py-2 text-right font-medium">Hoàn thành</th>
              <th className="py-2 text-right font-medium">Đọc trung bình</th>
              <th className="py-2 text-right font-medium">Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {data.docs.map((doc) => (
              <tr key={doc.docId} className="border-b last:border-0">
                <td className="max-w-72 py-2">
                  <a
                    href={`/courses/${courseSlug}/${data.version.slug}/${doc.path}`}
                    className="block truncate hover:underline"
                  >
                    {doc.title}
                  </a>
                </td>
                <td className="py-2 text-right tabular-nums">{numberFormat.format(doc.views)}</td>
                <td className="py-2 text-right tabular-nums">
                  {doc.completed} <span className="text-muted-foreground">({doc.completionRate}%)</span>
                </td>
                <td className="py-2 text-right tabular-nums">{doc.avgTimeSec ? formatDuration(doc.avgTimeSec) : '—'}</td>
                <td className="py-2 text-right">
                  <span className="inline-flex items-center gap-3 tabular-nums">
                    <span className="inline-flex items-center gap-1" title="Hữu ích">
                      <ThumbsUpIcon className="size-3.5 text-muted-foreground" aria-label="Hữu ích" />
                      {doc.helpful}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Chưa hữu ích">
                      <ThumbsDownIcon className="size-3.5 text-muted-foreground" aria-label="Chưa hữu ích" />
                      {doc.notHelpful}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SearchMisses({ misses, days }: { misses: CourseAnalytics['searchMisses']; days: number }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 font-medium">
          <SearchXIcon className="size-4 text-muted-foreground" /> Tìm mà không thấy
        </h2>
        <p className="text-sm text-muted-foreground">
          Từ khoá học viên tìm trong {days} ngày nhưng không có kết quả, gợi ý chủ đề nên viết thêm.
        </p>
      </div>
      {misses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Không có lượt tìm nào trượt.</p>
      ) : (
        <SimpleTable head={['Từ khoá', 'Số lần']} rows={misses.map((m) => [m.query, m.count])} />
      )}
    </section>
  );
}
