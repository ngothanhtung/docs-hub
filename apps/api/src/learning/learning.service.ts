import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { flattenDocs, type DocNode } from '../content/tree.js';
import { isVisibleToLearners, TreeService } from '../content/tree.service.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { CourseRole, ProgressStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type {
  CreateBookmarkDto,
  CreateNoteDto,
  FeedbackDto,
  ProgressHeartbeatDto,
} from './dto/learning.dto.js';


@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly courses: CoursesService,
    private readonly tree: TreeService,
    private readonly settings: SettingsService,
  ) {}

  /** Nhịp đọc gửi từ trang bài: cộng thời gian, cập nhật % cuộn, tự đánh dấu hoàn thành khi đủ điều kiện. */
  async heartbeat(user: AuthUser, docId: string, dto: ProgressHeartbeatDto) {
    await this.requireReadableDoc(user, docId);
    const existing = await this.prisma.progress.findUnique({
      where: { userId_docId: { userId: user.id, docId } },
    });
    const scrollPct = Math.max(existing?.scrollPct ?? 0, dto.scrollPct);
    const timeSpentSec = (existing?.timeSpentSec ?? 0) + dto.secondsDelta;
    // PRD F-RD-04: tự tính "đã đọc" khi cuộn đủ xa và đọc đủ lâu (mặc định 90% và 30 giây, admin chỉnh được).
    const { autoCompleteScrollPct, autoCompleteSeconds } = (await this.settings.get()).learning;
    const reachedGoal = scrollPct >= autoCompleteScrollPct && timeSpentSec >= autoCompleteSeconds;
    const completed = existing?.status === ProgressStatus.COMPLETED || reachedGoal;

    const progress = await this.prisma.progress.upsert({
      where: { userId_docId: { userId: user.id, docId } },
      create: {
        userId: user.id,
        docId,
        scrollPct,
        timeSpentSec,
        status: completed ? ProgressStatus.COMPLETED : ProgressStatus.IN_PROGRESS,
        completedAt: completed ? new Date() : null,
      },
      update: {
        scrollPct,
        timeSpentSec,
        ...(completed && existing?.status !== ProgressStatus.COMPLETED
          ? { status: ProgressStatus.COMPLETED, completedAt: new Date() }
          : {}),
      },
      select: { status: true, scrollPct: true, timeSpentSec: true, completedAt: true },
    });
    return { ...progress, completed: progress.status === ProgressStatus.COMPLETED };
  }

  /** Bấm "Đánh dấu hoàn thành" / bỏ đánh dấu. */
  async setCompleted(user: AuthUser, docId: string, completed: boolean) {
    await this.requireReadableDoc(user, docId);
    const status = completed ? ProgressStatus.COMPLETED : ProgressStatus.IN_PROGRESS;
    const progress = await this.prisma.progress.upsert({
      where: { userId_docId: { userId: user.id, docId } },
      create: { userId: user.id, docId, status, completedAt: completed ? new Date() : null },
      update: { status, completedAt: completed ? new Date() : null },
      select: { status: true, scrollPct: true, timeSpentSec: true, completedAt: true },
    });
    return { ...progress, completed };
  }

  /** Tiến độ trong một khoá học: bài đã xong (cho dấu check trên sidebar), % và bài đang đọc dở. */
  async courseProgress(user: AuthUser, courseSlug: string, versionSlug?: string) {
    const course = await this.courses.findByIdOrSlug(courseSlug);
    await this.access.requireCourse(user, course.id, CourseRole.LEARNER);
    const version = versionSlug
      ? await this.prisma.version.findUnique({ where: { courseId_slug: { courseId: course.id, slug: versionSlug } } })
      : await this.courses.defaultVersionFor(user, course.id);
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản');
    return { version: { id: version.id, slug: version.slug }, ...(await this.summarize(user.id, version.id)) };
  }

  /** Tiến độ ở mọi khoá học của người dùng, cho thẻ khoá học ở trang chủ. */
  async summary(user: AuthUser) {
    const memberships = await this.prisma.courseMember.findMany({
      where: { userId: user.id, course: { archivedAt: null } },
      select: { courseId: true },
    });
    return Promise.all(
      memberships.map(async ({ courseId }) => {
        const version = await this.courses.defaultVersionFor(user, courseId).catch(() => null);
        if (!version) return { courseId, total: 0, completed: 0, percent: 0, lastDoc: null };
        const { total, completedDocIds, percent, lastDoc } = await this.summarize(user.id, version.id);
        return { courseId, versionSlug: version.slug, total, completed: completedDocIds.length, percent, lastDoc };
      }),
    );
  }

  private async summarize(userId: string, versionId: string) {
    const docs = flattenDocs(await this.tree.learnerTree(versionId));
    const rows = await this.prisma.progress.findMany({
      where: { userId, docId: { in: docs.map((d) => d.id) } },
      select: { docId: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    const completedDocIds = rows.filter((r) => r.status === ProgressStatus.COMPLETED).map((r) => r.docId);
    const last = rows[0] ? docs.find((d) => d.id === rows[0].docId) : undefined;
    return {
      total: docs.length,
      completedDocIds,
      percent: docs.length === 0 ? 0 : Math.round((completedDocIds.length / docs.length) * 100),
      lastDoc: last ? { id: last.id, path: last.path, label: last.label, updatedAt: rows[0].updatedAt } : null,
    };
  }

  async listBookmarks(user: AuthUser, courseSlug?: string) {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId: user.id, ...(courseSlug ? { doc: { version: { course: { slug: courseSlug } } } } : {}) },
      include: { doc: { select: docLinkSelect } },
      orderBy: { createdAt: 'desc' },
    });
    const paths = await this.pathsFor(bookmarks.map((b) => b.doc));
    return bookmarks.map((b) => ({
      id: b.id,
      anchor: b.anchor,
      label: b.label,
      createdAt: b.createdAt,
      doc: linkOf(b.doc, paths),
    }));
  }

  async addBookmark(user: AuthUser, dto: CreateBookmarkDto) {
    await this.requireReadableDoc(user, dto.docId);
    return this.prisma.bookmark.upsert({
      where: { userId_docId_anchor: { userId: user.id, docId: dto.docId, anchor: dto.anchor } },
      create: { userId: user.id, docId: dto.docId, anchor: dto.anchor, label: dto.label },
      update: { label: dto.label },
      select: { id: true, anchor: true, label: true },
    });
  }

  async removeBookmark(user: AuthUser, id: string) {
    const { count } = await this.prisma.bookmark.deleteMany({ where: { id, userId: user.id } });
    if (count === 0) throw new NotFoundException('Không tìm thấy bookmark');
  }

  async listNotes(user: AuthUser, filter: { course?: string; docId?: string }) {
    const notes = await this.prisma.note.findMany({
      where: {
        userId: user.id,
        ...(filter.docId ? { docId: filter.docId } : {}),
        ...(filter.course ? { doc: { version: { course: { slug: filter.course } } } } : {}),
      },
      include: { doc: { select: docLinkSelect } },
      orderBy: { createdAt: 'desc' },
    });
    const paths = await this.pathsFor(notes.map((n) => n.doc));
    return notes.map((n) => ({
      id: n.id,
      anchor: n.anchor,
      quote: n.quote,
      content: n.content,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      doc: linkOf(n.doc, paths),
    }));
  }

  async createNote(user: AuthUser, dto: CreateNoteDto) {
    await this.requireReadableDoc(user, dto.docId);
    return this.prisma.note.create({
      data: { userId: user.id, docId: dto.docId, anchor: dto.anchor, quote: dto.quote, content: dto.content },
    });
  }

  async updateNote(user: AuthUser, id: string, content: string) {
    await this.ownNote(user, id);
    return this.prisma.note.update({ where: { id }, data: { content } });
  }

  async removeNote(user: AuthUser, id: string) {
    await this.ownNote(user, id);
    await this.prisma.note.delete({ where: { id } });
  }

  /** "Bài này có hữu ích?" — mỗi người một đánh giá cho mỗi bài, gửi lại thì cập nhật. */
  async setFeedback(user: AuthUser, docId: string, dto: FeedbackDto) {
    await this.requireReadableDoc(user, docId);
    return this.prisma.feedback.upsert({
      where: { userId_docId: { userId: user.id, docId } },
      create: { userId: user.id, docId, helpful: dto.helpful, comment: dto.comment },
      update: { helpful: dto.helpful, comment: dto.comment },
      select: { helpful: true, comment: true },
    });
  }

  /** Học viên chỉ tương tác được với bài đang hiển thị trong khoá mình được ghi danh. */
  private async requireReadableDoc(user: AuthUser, docId: string) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.LEARNER);
    if (!isVisibleToLearners(doc)) throw new NotFoundException('Không tìm thấy bài viết');
    return doc;
  }

  private async ownNote(user: AuthUser, id: string) {
    const note = await this.prisma.note.findUnique({ where: { id }, select: { userId: true } });
    if (!note) throw new NotFoundException('Không tìm thấy ghi chú');
    if (note.userId !== user.id) throw new ForbiddenException('Đây không phải ghi chú của bạn');
  }

  /** Đường dẫn của từng bài (theo cây của version chứa bài). */
  private async pathsFor(docs: { id: string; versionId: string }[]) {
    const paths = new Map<string, DocNode>();
    for (const versionId of new Set(docs.map((d) => d.versionId))) {
      for (const node of flattenDocs(await this.tree.learnerTree(versionId))) paths.set(node.id, node);
    }
    return paths;
  }
}

const docLinkSelect = {
  id: true,
  versionId: true,
  publishedRevision: { select: { title: true } },
  version: { select: { slug: true, course: { select: { slug: true, title: true } } } },
} as const;

function linkOf(
  doc: {
    id: string;
    publishedRevision: { title: string } | null;
    version: { slug: string; course: { slug: string; title: string } };
  },
  paths: Map<string, DocNode>,
) {
  const node = paths.get(doc.id);
  return {
    id: doc.id,
    title: doc.publishedRevision?.title ?? node?.label ?? 'Bài đã gỡ',
    courseSlug: doc.version.course.slug,
    courseTitle: doc.version.course.title,
    versionSlug: doc.version.slug,
    // null = bài đã bị gỡ hoặc lưu trữ, học viên không mở được nữa.
    path: node?.path ?? null,
  };
}
