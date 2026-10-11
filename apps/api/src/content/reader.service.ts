import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { EventsService } from '../events/events.service.js';
import { CourseRole, ProgressStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchIndexService } from '../search/search-index.service.js';
import { findByPath, flattenDocs, type DocNode } from './tree.js';
import { isVisibleToLearners, TreeService } from './tree.service.js';

/** API cho trang đọc của học viên: chỉ trả nội dung đã xuất bản. */
@Injectable()
export class ReaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly courses: CoursesService,
    private readonly tree: TreeService,
    private readonly search: SearchIndexService,
    private readonly events: EventsService,
  ) {}

  /** Sidebar của khoá học + danh sách version để học viên chuyển đổi. */
  async getTree(user: AuthUser, courseSlug: string, versionSlug?: string) {
    const { course, version, role } = await this.resolve(user, courseSlug, versionSlug);
    const [versions, tree] = await Promise.all([
      this.prisma.version.findMany({
        where: { courseId: course.id },
        select: { id: true, slug: true, label: true, isCurrent: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.tree.learnerTree(version.id),
    ]);
    return {
      course: pickCourse(course),
      version: { id: version.id, slug: version.slug, label: version.label },
      versions,
      role,
      tree,
    };
  }

  /** Một trang theo đường dẫn: bài viết (kèm prev/next) hoặc trang giới thiệu của nhóm bài. */
  async getPage(user: AuthUser, courseSlug: string, path: string, versionSlug?: string) {
    const { course, version, role } = await this.resolve(user, courseSlug, versionSlug);
    const tree = await this.tree.learnerTree(version.id);
    const found = findByPath(tree, path);
    if (!found) throw new NotFoundException('Không tìm thấy trang');
    const breadcrumb = found.breadcrumb.map((c) => ({ label: c.label, path: c.path }));
    const context = {
      course: pickCourse(course),
      version: { id: version.id, slug: version.slug, label: version.label },
      breadcrumb,
    };

    if (found.node.type === 'category') {
      return {
        ...context,
        type: 'category' as const,
        category: {
          id: found.node.id,
          label: found.node.label,
          description: found.node.description,
          icon: found.node.icon,
          items: found.node.children.map((child) => ({
            type: child.type,
            id: child.id,
            label: child.label,
            path: child.path,
          })),
        },
      };
    }

    const doc = await this.prisma.doc.findUnique({
      where: { id: found.node.id },
      select: {
        id: true,
        status: true,
        publishAt: true,
        publishedAt: true,
        publishedRevisionId: true,
        publishedRevision: {
          select: {
            title: true,
            html: true,
            toc: true,
            frontmatter: true,
            readingTime: true,
            createdAt: true,
          },
        },
      },
    });
    // Kiểm tra lại vì bài có thể vừa bị gỡ giữa hai truy vấn.
    if (!doc?.publishedRevision || !isVisibleToLearners(doc)) {
      throw new NotFoundException('Không tìm thấy trang');
    }

    const ordered = flattenDocs(tree);
    const index = ordered.findIndex((d) => d.id === doc.id);
    // Chỉ đếm lượt xem của học viên; chủ khoá/biên tập viên xem thử không làm sai thống kê.
    if (role === CourseRole.LEARNER) {
      this.events.record({ type: 'doc_view', userId: user.id, courseId: course.id, docId: doc.id });
    }
    const [progress, bookmarks, feedback] = await Promise.all([
      this.prisma.progress.findUnique({
        where: { userId_docId: { userId: user.id, docId: doc.id } },
        select: { status: true },
      }),
      this.prisma.bookmark.findMany({
        where: { userId: user.id, docId: doc.id },
        select: { id: true, anchor: true },
      }),
      this.prisma.feedback.findUnique({
        where: { userId_docId: { userId: user.id, docId: doc.id } },
        select: { helpful: true, comment: true },
      }),
    ]);
    const frontmatter = doc.publishedRevision.frontmatter as {
      description?: string;
      tags?: string[];
    };
    return {
      ...context,
      type: 'doc' as const,
      doc: {
        id: doc.id,
        path,
        title: doc.publishedRevision.title,
        description: frontmatter.description ?? null,
        tags: frontmatter.tags ?? [],
        html: doc.publishedRevision.html,
        toc: doc.publishedRevision.toc,
        readingTime: doc.publishedRevision.readingTime,
        updatedAt: doc.publishedAt ?? doc.publishedRevision.createdAt,
      },
      prev: pickNav(ordered[index - 1]),
      next: pickNav(ordered[index + 1]),
      me: {
        completed: progress?.status === ProgressStatus.COMPLETED,
        bookmarks,
        feedback,
      },
    };
  }

  /**
   * Tìm trong bài đã xuất bản của một version. Kết quả là từng mục (heading) của bài,
   * kèm đoạn trích có tô sáng từ khoá.
   */
  async searchDocs(user: AuthUser, courseSlug: string, query: string, versionSlug?: string) {
    const { course, version, role } = await this.resolve(user, courseSlug, versionSlug);
    const q = query.trim();
    if (!q) return { query: q, hits: [] };
    const result = await this.search.search(version.id, q, 20);
    if (role === CourseRole.LEARNER) {
      this.events.record({
        type: 'search',
        userId: user.id,
        courseId: course.id,
        payload: { q: q.slice(0, 100), results: result.estimatedTotalHits ?? result.hits.length },
      });
    }
    return {
      query: q,
      hits: result.hits.map((hit) => ({
        docId: hit.docId,
        path: hit.path,
        anchor: hit.anchor,
        title: highlight(hit._formatted?.title ?? hit.title),
        heading: hit.heading ? highlight(hit._formatted?.heading ?? hit.heading) : null,
        snippet: highlight(hit._formatted?.content ?? ''),
      })),
    };
  }

  private async resolve(user: AuthUser, courseSlug: string, versionSlug?: string) {
    const course = await this.courses.findByIdOrSlug(courseSlug);
    const { role } = await this.access.requireCourse(user, course.id, CourseRole.LEARNER);
    const version = versionSlug
      ? await this.prisma.version.findUnique({
          where: { courseId_slug: { courseId: course.id, slug: versionSlug } },
        })
      : await this.courses.defaultVersionFor(user, course.id);
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản');
    return { course, version, role };
  }
}

function pickCourse(course: {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  theme: string | null;
  primaryColor: string | null;
}) {
  const { id, slug, title, coverUrl, theme, primaryColor } = course;
  return { id, slug, title, coverUrl, theme, primaryColor };
}

function pickNav(doc: DocNode | undefined) {
  return doc ? { label: doc.label, path: doc.path } : null;
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Thoát HTML của nội dung rồi mới gắn <mark>: nội dung bài không thể chèn thẻ vào kết quả tìm kiếm. */
function highlight(text: string) {
  return text
    .replace(/[&<>"']/g, (c) => HTML_ESCAPES[c])
    // Ký tự điều khiển \u0001/\u0002 là dấu tô sáng do Meilisearch trả về (đặt trong SearchIndexService).
    .replaceAll('\u0001', '<mark>')
    .replaceAll('\u0002', '</mark>');
}
