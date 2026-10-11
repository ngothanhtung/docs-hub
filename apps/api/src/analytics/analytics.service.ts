import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { flattenDocs } from '../content/tree.js';
import { TreeService } from '../content/tree.service.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import { CourseRole, ProgressStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Gom số liệu theo ngày giờ Việt Nam, không theo UTC. */
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** Nhóm % hoàn thành khoá học của học viên cho biểu đồ phân bố. */
const BUCKETS = [
  { label: '0%', min: 0, max: 0 },
  { label: '1–25%', min: 1, max: 25 },
  { label: '26–50%', min: 26, max: 50 },
  { label: '51–75%', min: 51, max: 75 },
  { label: '76–99%', min: 76, max: 99 },
  { label: '100%', min: 100, max: 100 },
];

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly tree: TreeService,
  ) {}

  /**
   * Toàn bộ số liệu của dashboard một khoá học trong `days` ngày gần nhất.
   * Tiến độ tính trên bài đang hiển thị của `versionSlug` (mặc định version hiện hành).
   */
  async course(user: AuthUser, courseId: string, options: { versionSlug?: string; days: number }) {
    await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    const version = await this.prisma.version.findFirst({
      where: options.versionSlug ? { courseId, slug: options.versionSlug } : { courseId, isCurrent: true },
    });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản');

    const since = startOfDay(options.days - 1);
    const docs = flattenDocs(await this.tree.learnerTree(version.id));
    const docIds = docs.map((d) => d.id);
    const learners = await this.prisma.courseMember.findMany({
      where: { courseId, role: CourseRole.LEARNER },
      select: { userId: true },
    });
    const learnerIds = learners.map((l) => l.userId);

    const [progress, viewsByDoc, feedback, daily, activeLearners, searchMisses] = await Promise.all([
      this.prisma.progress.findMany({
        where: { docId: { in: docIds }, userId: { in: learnerIds } },
        select: { userId: true, docId: true, status: true, timeSpentSec: true },
      }),
      this.prisma.event.groupBy({
        by: ['docId'],
        where: { courseId, type: 'doc_view', at: { gte: since }, docId: { in: docIds } },
        _count: { _all: true },
      }),
      this.prisma.feedback.groupBy({
        by: ['docId', 'helpful'],
        where: { docId: { in: docIds } },
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ day: string; active: bigint; views: bigint }[]>`
        -- "at" là TIMESTAMP không múi giờ, lưu giờ UTC: gắn UTC trước rồi mới đổi sang giờ Việt Nam.
        SELECT to_char(date_trunc('day', ("at" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}), 'YYYY-MM-DD') AS day,
               COUNT(DISTINCT "userId") AS active,
               COUNT(*) AS views
        FROM events
        WHERE "courseId" = ${courseId}::uuid AND type = 'doc_view' AND "at" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT "userId") AS count
        FROM events
        WHERE "courseId" = ${courseId}::uuid AND type = 'doc_view' AND "at" >= ${since}`,
      this.prisma.$queryRaw<{ query: string; count: bigint }[]>`
        SELECT lower(payload->>'q') AS query, COUNT(*) AS count
        FROM events
        WHERE "courseId" = ${courseId}::uuid AND type = 'search' AND "at" >= ${since}
          AND (payload->>'results')::int = 0
        GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20`,
    ]);

    // Theo bài, đúng thứ tự trên sidebar.
    const views = new Map(viewsByDoc.map((v) => [v.docId, v._count._all]));
    const docStats = docs.map((doc) => {
      const rows = progress.filter((p) => p.docId === doc.id);
      const completed = rows.filter((p) => p.status === ProgressStatus.COMPLETED).length;
      const timed = rows.filter((p) => p.timeSpentSec > 0);
      const votes = (helpful: boolean) =>
        feedback.find((f) => f.docId === doc.id && f.helpful === helpful)?._count._all ?? 0;
      return {
        docId: doc.id,
        title: doc.label,
        path: doc.path,
        views: views.get(doc.id) ?? 0,
        completed,
        completionRate: learnerIds.length === 0 ? 0 : Math.round((completed / learnerIds.length) * 100),
        avgTimeSec: timed.length === 0 ? 0 : Math.round(timed.reduce((s, p) => s + p.timeSpentSec, 0) / timed.length),
        helpful: votes(true),
        notHelpful: votes(false),
      };
    });

    // Mỗi học viên: % bài đã hoàn thành trong version.
    const percentByLearner = learnerIds.map((id) => {
      const done = progress.filter((p) => p.userId === id && p.status === ProgressStatus.COMPLETED).length;
      return docs.length === 0 ? 0 : Math.round((done / docs.length) * 100);
    });
    const distribution = BUCKETS.map((b) => ({
      label: b.label,
      learners: percentByLearner.filter((p) => p >= b.min && p <= b.max).length,
    }));

    const dailyMap = new Map(daily.map((d) => [d.day, d]));
    return {
      version: { id: version.id, slug: version.slug, label: version.label },
      days: options.days,
      overview: {
        learners: learnerIds.length,
        activeLearners: Number(activeLearners[0]?.count ?? 0),
        views: docStats.reduce((s, d) => s + d.views, 0),
        publishedDocs: docs.length,
        avgCompletion:
          percentByLearner.length === 0
            ? 0
            : Math.round(percentByLearner.reduce((s, p) => s + p, 0) / percentByLearner.length),
      },
      daily: dayRange(options.days).map((day) => ({
        day,
        activeLearners: Number(dailyMap.get(day)?.active ?? 0),
        views: Number(dailyMap.get(day)?.views ?? 0),
      })),
      docs: docStats,
      distribution,
      searchMisses: searchMisses.map((m) => ({ query: m.query, count: Number(m.count) })),
    };
  }
}

/** Ngày dạng YYYY-MM-DD theo giờ Việt Nam. */
function vnDay(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

/** 0 giờ (giờ Việt Nam) của `daysAgo` ngày trước. */
function startOfDay(daysAgo: number) {
  const day = vnDay(new Date(Date.now() - daysAgo * 86_400_000));
  return new Date(`${day}T00:00:00+07:00`);
}

function dayRange(days: number) {
  return Array.from({ length: days }, (_, i) => vnDay(new Date(Date.now() - (days - 1 - i) * 86_400_000)));
}
