'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Cohort, CourseDetail, CourseMember, VersionItem } from '@/lib/api-types';
import { AppearanceTab } from './appearance-tab';
import { CohortsTab } from './cohorts-tab';
import { InfoTab } from './info-tab';
import { MembersTab } from './members-tab';
import { VersionsTab } from './versions-tab';

const TABS = ['info', 'appearance', 'members', 'cohorts', 'versions'] as const;
type Tab = (typeof TABS)[number];

export function CourseSettings({
  course,
  members,
  cohorts,
  versions,
  initialTab,
}: {
  course: CourseDetail;
  members: CourseMember[];
  cohorts: Cohort[];
  versions: VersionItem[];
  initialTab: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tab: Tab = (TABS as readonly string[]).includes(initialTab) ? (initialTab as Tab) : 'info';

  return (
    <Tabs
      value={tab}
      // Ghi tab vào URL để tải lại trang hoặc gửi link vẫn mở đúng tab.
      onValueChange={(value) => router.replace(`${pathname}?tab=${String(value)}`, { scroll: false })}
    >
      <TabsList className="mb-6">
        <TabsTrigger value="info">Thông tin</TabsTrigger>
        <TabsTrigger value="appearance">Giao diện</TabsTrigger>
        <TabsTrigger value="members">Thành viên ({members.length})</TabsTrigger>
        <TabsTrigger value="cohorts">Lớp học ({cohorts.length})</TabsTrigger>
        <TabsTrigger value="versions">Phiên bản ({versions.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="info">
        <InfoTab course={course} />
      </TabsContent>
      <TabsContent value="appearance">
        <AppearanceTab course={course} />
      </TabsContent>
      <TabsContent value="members">
        <MembersTab courseId={course.id} ownerId={course.ownerId} members={members} cohorts={cohorts} />
      </TabsContent>
      <TabsContent value="cohorts">
        <CohortsTab courseId={course.id} cohorts={cohorts} versions={versions} />
      </TabsContent>
      <TabsContent value="versions">
        <VersionsTab courseId={course.id} courseSlug={course.slug} versions={versions} />
      </TabsContent>
    </Tabs>
  );
}
