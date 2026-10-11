import { Injectable } from '@nestjs/common';
import { StorageService } from '../assets/storage.service.js';
import { DocStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchIndexService } from '../search/search-index.service.js';

const TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86_400_000;

/** Ngày theo giờ Việt Nam dạng YYYY-MM-DD. */
function vnDay(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

/** 00:00 giờ Việt Nam của `daysAgo` ngày trước (tính cả hôm nay là ngày 0). */
function startOfVnDay(daysAgo: number) {
  const day = vnDay(new Date(Date.now() - daysAgo * DAY_MS));
  return new Date(`${day}T00:00:00+07:00`);
}

/** % thay đổi so với kỳ trước; null khi kỳ trước bằng 0 (không so được). */
function trend(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const toNumber = (value: bigint | number | null | undefined) => Number(value ?? 0);

/**
 * Số liệu toàn hệ thống cho trang Quản trị. Thời gian tính theo giờ Việt Nam;
 * cột timestamp lưu giờ UTC nên luôn gắn UTC trước khi đổi múi giờ.
 */
@Injectable()
export class AdminService {
  private readonly startedAt = new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchIndexService,
    private readonly storage: StorageService,
  ) {}

  async overview(days: number) {
    const since = startOfVnDay(days - 1);
    const previousSince = new Date(since.getTime() - days * DAY_MS);

    const [
      users,
      usersByRole,
      newUsers,
      previousNewUsers,
      courses,
      archivedCourses,
      publishedDocs,
      storage,
      activity,
      previousActivity,
      daily,
      signups,
      topCourses,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({ by: ['systemRole'], _count: { _all: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { createdAt: { gte: previousSince, lt: since } } }),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { archivedAt: { not: null } } }),
      this.prisma.doc.count({ where: { publishedRevisionId: { not: null }, status: { not: DocStatus.ARCHIVED } } }),
      this.prisma.asset.aggregate({ _sum: { size: true }, _count: { _all: true }, where: { uploadedAt: { not: null } } }),
      this.activity(since, new Date(Date.now() + DAY_MS)),
      this.activity(previousSince, since),
      this.prisma.$queryRaw<{ day: string; views: bigint; active: bigint; searches: bigint }[]>`
        SELECT to_char(date_trunc('day', ("at" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}), 'YYYY-MM-DD') AS day,
               COUNT(*) FILTER (WHERE type = 'doc_view') AS views,
               COUNT(DISTINCT "userId") FILTER (WHERE type = 'doc_view') AS active,
               COUNT(*) FILTER (WHERE type = 'search') AS searches
        FROM events WHERE "at" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ day: string; signups: bigint }[]>`
        SELECT to_char(date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}), 'YYYY-MM-DD') AS day,
               COUNT(*) AS signups
        FROM users WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ id: string; title: string; slug: string; views: bigint; learners: bigint }[]>`
        SELECT c.id, c.title, c.slug, COUNT(*) AS views, COUNT(DISTINCT e."userId") AS learners
        FROM events e JOIN courses c ON c.id = e."courseId"
        WHERE e.type = 'doc_view' AND e."at" >= ${since}
        GROUP BY c.id ORDER BY views DESC LIMIT 5`,
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, name: true, email: true, systemRole: true, isActive: true, createdAt: true, avatarUrl: true },
      }),
    ]);

    const dailyMap = new Map(daily.map((d) => [d.day, d]));
    const signupMap = new Map(signups.map((d) => [d.day, toNumber(d.signups)]));
    const series = Array.from({ length: days }, (_, i) => {
      const day = vnDay(new Date(Date.now() - (days - 1 - i) * DAY_MS));
      const row = dailyMap.get(day);
      return {
        day,
        views: toNumber(row?.views),
        activeUsers: toNumber(row?.active),
        searches: toNumber(row?.searches),
        signups: signupMap.get(day) ?? 0,
      };
    });

    return {
      days,
      kpis: {
        users: { total: users, new: newUsers, trend: trend(newUsers, previousNewUsers) },
        activeUsers: {
          total: activity.activeUsers,
          trend: trend(activity.activeUsers, previousActivity.activeUsers),
        },
        views: { total: activity.views, trend: trend(activity.views, previousActivity.views) },
        searches: {
          total: activity.searches,
          misses: activity.searchMisses,
          trend: trend(activity.searches, previousActivity.searches),
        },
        courses: { total: courses, archived: archivedCourses, publishedDocs },
        storage: { bytes: toNumber(storage._sum.size), files: storage._count._all },
      },
      roles: Object.fromEntries(usersByRole.map((r) => [r.systemRole, r._count._all])),
      daily: series,
      topCourses: topCourses.map((c) => ({ ...c, views: toNumber(c.views), learners: toNumber(c.learners) })),
      recentUsers,
    };
  }

  private async activity(from: Date, to: Date) {
    const [row] = await this.prisma.$queryRaw<
      { views: bigint; active: bigint; searches: bigint; misses: bigint }[]
    >`
      SELECT COUNT(*) FILTER (WHERE type = 'doc_view') AS views,
             COUNT(DISTINCT "userId") FILTER (WHERE type = 'doc_view') AS active,
             COUNT(*) FILTER (WHERE type = 'search') AS searches,
             COUNT(*) FILTER (WHERE type = 'search' AND COALESCE((payload->>'results')::int, 0) = 0) AS misses
      FROM events WHERE "at" >= ${from} AND "at" < ${to}`;
    return {
      views: toNumber(row?.views),
      activeUsers: toNumber(row?.active),
      searches: toNumber(row?.searches),
      searchMisses: toNumber(row?.misses),
    };
  }

  /** Mọi khoá học (kể cả đã lưu trữ) kèm chủ khoá và số liệu 30 ngày. */
  async courses() {
    const since = startOfVnDay(29);
    const [courses, views, docs] = await Promise.all([
      this.prisma.course.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true, versions: true, assets: true } },
          members: { where: { role: 'LEARNER' }, select: { userId: true } },
        },
      }),
      this.prisma.$queryRaw<{ courseId: string; views: bigint; learners: bigint }[]>`
        SELECT "courseId", COUNT(*) AS views, COUNT(DISTINCT "userId") AS learners
        FROM events WHERE type = 'doc_view' AND "at" >= ${since} AND "courseId" IS NOT NULL
        GROUP BY "courseId"`,
      this.prisma.$queryRaw<{ courseId: string; total: bigint; published: bigint }[]>`
        SELECT v."courseId", COUNT(d.id) AS total,
               COUNT(d.id) FILTER (WHERE d."publishedRevisionId" IS NOT NULL AND d.status <> 'ARCHIVED') AS published
        FROM docs d JOIN versions v ON v.id = d."versionId"
        GROUP BY v."courseId"`,
    ]);
    const viewMap = new Map(views.map((v) => [v.courseId, v]));
    const docMap = new Map(docs.map((d) => [d.courseId, d]));
    return courses.map(({ _count, members, ...course }) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      theme: course.theme,
      archivedAt: course.archivedAt,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      owner: course.owner,
      members: _count.members,
      learners: members.length,
      versions: _count.versions,
      assets: _count.assets,
      docs: toNumber(docMap.get(course.id)?.total),
      publishedDocs: toNumber(docMap.get(course.id)?.published),
      views30d: toNumber(viewMap.get(course.id)?.views),
      activeLearners30d: toNumber(viewMap.get(course.id)?.learners),
    }));
  }

  /** Tình trạng các dịch vụ phụ thuộc. */
  async system() {
    const dbStarted = Date.now();
    let database: { ok: boolean; latencyMs?: number; error?: string };
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = { ok: true, latencyMs: Date.now() - dbStarted };
    } catch (error) {
      database = { ok: false, error: (error as Error).message };
    }
    const [search, storage, counts] = await Promise.all([
      this.search.status(),
      this.storage.status(),
      Promise.all([
        this.prisma.user.count(),
        this.prisma.course.count(),
        this.prisma.doc.count(),
        this.prisma.docRevision.count(),
        this.prisma.event.count(),
        this.prisma.asset.count(),
      ]),
    ]);
    const [users, courses, docs, revisions, events, assets] = counts;
    return {
      api: {
        ok: true,
        node: process.version,
        env: process.env.NODE_ENV ?? 'development',
        startedAt: this.startedAt,
        uptimeSec: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
      database,
      search,
      storage,
      rows: { users, courses, docs, revisions, events, assets },
    };
  }
}
