import { BookOpenIcon, FileTextIcon, HardDriveIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ChartAreaInteractive } from '@/components/admin/chart-area-interactive';
import { SectionCards } from '@/components/admin/section-cards';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const number = new Intl.NumberFormat('vi-VN');
const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' });
import { apiFetch } from '@/lib/api';
import { formatBytes, initials, ROLE_LABEL } from '@/lib/admin-format';
import type { AdminOverview, SystemRole } from '@/lib/api-types';

export const metadata: Metadata = { title: 'Quản trị' };
export default async function AdminOverviewPage({ searchParams }: PageProps<'/admin'>) {
  const { days } = await searchParams;
  const range = ['7', '30', '90'].includes(String(days)) ? String(days) : '30';
  const data = await apiFetch<AdminOverview>(`/admin/overview?days=${range}`);
  const { kpis } = data;

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <SectionCards data={data} />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive data={data} />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @xl/main:grid-cols-3">
        <MiniStat
          icon={<BookOpenIcon />}
          label="Khoá học"
          value={number.format(kpis.courses.total)}
          note={`${number.format(kpis.courses.archived)} đã lưu trữ`}
        />
        <MiniStat
          icon={<FileTextIcon />}
          label="Bài đã xuất bản"
          value={number.format(kpis.courses.publishedDocs)}
          note="Đang hiển thị cho học viên"
        />
        <MiniStat
          icon={<HardDriveIcon />}
          label="Dung lượng ảnh"
          value={formatBytes(kpis.storage.bytes)}
          note={`${number.format(kpis.storage.files)} file trên S3`}
        />
      </div>
      <Tabs defaultValue="courses" className="px-4 lg:px-6">
        <TabsList>
          <TabsTrigger value="courses">Khoá học nổi bật</TabsTrigger>
          <TabsTrigger value="users">
            Người dùng mới <Badge variant="secondary">{data.recentUsers.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="roles">Vai trò</TabsTrigger>
        </TabsList>
        <TabsContent value="courses">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Khoá học</TableHead>
                  <TableHead className="text-right">Lượt xem ({data.days} ngày)</TableHead>
                  <TableHead className="text-right">Người học</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topCourses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                      Chưa có lượt xem nào trong {data.days} ngày qua.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.topCourses.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <Link href={`/studio/${course.slug}/analytics`} className="font-medium hover:underline">
                          {course.title}
                        </Link>
                        <div className="text-xs text-muted-foreground">/{course.slug}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{number.format(course.views)}</TableCell>
                      <TableCell className="text-right tabular-nums">{number.format(course.learners)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="users">
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader className="bg-muted">
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{user.name}</div>
                          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABEL[user.systemRole]}</Badge>
                    </TableCell>
                    <TableCell>{user.isActive ? 'Hoạt động' : 'Đã khoá'}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{date.format(new Date(user.createdAt))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Link href="/admin/users" className="mt-2 inline-block text-sm text-primary hover:underline">
            Quản lý người dùng →
          </Link>
        </TabsContent>
        <TabsContent value="roles">
          <div className="grid gap-4 @xl/main:grid-cols-3">
            {(Object.keys(ROLE_LABEL) as SystemRole[]).map((role) => (
              <MiniStat key={role} label={ROLE_LABEL[role]} value={number.format(data.roles[role] ?? 0)} note="tài khoản" />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniStat({ icon, label, value, note }: { icon?: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5 [&_svg]:size-4">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{note}</CardContent>
    </Card>
  );
}
