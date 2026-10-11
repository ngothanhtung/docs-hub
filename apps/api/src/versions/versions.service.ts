import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { uniqueSlug } from '../common/unique-slug.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { CourseRole, DocStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchIndexService } from '../search/search-index.service.js';
import type { CreateVersionDto, UpdateVersionDto } from './dto/version.dto.js';

type Tx = Prisma.TransactionClient;

/** Trùng với đường dẫn của web (/studio/:course/settings) nên không dùng làm slug version. */
const RESERVED_VERSION_SLUGS = new Set(['settings']);

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly search: SearchIndexService,
  ) {}

  async list(user: AuthUser, courseId: string) {
    await this.access.requireCourse(user, courseId, CourseRole.LEARNER);
    return this.prisma.version.findMany({
      where: { courseId },
      include: { _count: { select: { docs: true, cohorts: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Tạo version mới. Có `copyFromVersionId` thì "cắt phiên bản": sao chép nhóm bài, bài,
   * bản nháp và bản đã xuất bản sang version mới, version cũ giữ nguyên cho lớp cũ.
   */
  async create(user: AuthUser, courseId: string, dto: CreateVersionDto) {
    await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    if (dto.copyFromVersionId) {
      const count = await this.prisma.version.count({
        where: { id: dto.copyFromVersionId, courseId },
      });
      if (count === 0) throw new BadRequestException('Version nguồn không thuộc khoá học này');
    }
    const slug = dto.slug
      ? await this.assertSlugFree(courseId, dto.slug)
      : await uniqueSlug(dto.label, (s) => this.slugTaken(courseId, s), 'v');

    const version = await this.prisma.$transaction(
      async (tx) => {
        if (dto.makeCurrent) {
          await tx.version.updateMany({ where: { courseId }, data: { isCurrent: false } });
        }
        const version = await tx.version.create({
          data: { courseId, label: dto.label, slug, isCurrent: dto.makeCurrent ?? false },
        });
        if (dto.copyFromVersionId) {
          await copyContent(tx, dto.copyFromVersionId, version.id, user.id);
        }
        return version;
      },
      { timeout: 60_000 },
    );
    if (dto.copyFromVersionId) this.search.scheduleVersion(version.id);
    return version;
  }

  async update(user: AuthUser, versionId: string, dto: UpdateVersionDto) {
    await this.access.requireVersion(user, versionId, CourseRole.OWNER);
    return this.prisma.version.update({
      where: { id: versionId },
      data: {
        label: dto.label,
        ...(dto.frozen === undefined ? {} : { frozenAt: dto.frozen ? new Date() : null }),
      },
    });
  }

  /** Version hiện hành là version mặc định cho học viên không thuộc lớp nào. */
  async makeCurrent(user: AuthUser, versionId: string) {
    const { version } = await this.access.requireVersion(user, versionId, CourseRole.OWNER);
    const [, current] = await this.prisma.$transaction([
      this.prisma.version.updateMany({
        where: { courseId: version.courseId },
        data: { isCurrent: false },
      }),
      this.prisma.version.update({ where: { id: versionId }, data: { isCurrent: true } }),
    ]);
    return current;
  }

  async remove(user: AuthUser, versionId: string) {
    const { version } = await this.access.requireVersion(user, versionId, CourseRole.OWNER);
    if (version.isCurrent) {
      throw new ConflictException('Không thể xoá version hiện hành, hãy chọn version khác trước');
    }
    const cohorts = await this.prisma.cohort.count({ where: { versionId } });
    if (cohorts > 0) {
      throw new ConflictException('Version đang được gán cho lớp học, hãy đổi version của lớp trước');
    }
    await this.prisma.version.delete({ where: { id: versionId } });
    await this.search.removeVersion(versionId).catch(() => undefined);
  }

  private async slugTaken(courseId: string, slug: string) {
    if (RESERVED_VERSION_SLUGS.has(slug)) return true;
    return (await this.prisma.version.count({ where: { courseId, slug } })) > 0;
  }

  private async assertSlugFree(courseId: string, slug: string) {
    if (await this.slugTaken(courseId, slug)) {
      throw new ConflictException('Slug version đã được dùng trong khoá học');
    }
    return slug;
  }
}

/**
 * Sao chép nội dung giữa hai version. Bản đã xuất bản được chép thành revision #1 của
 * bài mới để học viên lớp mới thấy ngay; bản nháp chép nguyên.
 */
async function copyContent(tx: Tx, fromVersionId: string, toVersionId: string, userId: string) {
  const categories = await tx.category.findMany({ where: { versionId: fromVersionId } });
  const categoryIds = new Map(categories.map((c) => [c.id, randomUUID()]));
  // Cha phải được tạo trước con: sắp theo độ sâu.
  const depth = (id: string | null): number =>
    id === null ? 0 : 1 + depth(categories.find((c) => c.id === id)?.parentId ?? null);
  const ordered = [...categories].sort((a, b) => depth(a.id) - depth(b.id));
  await tx.category.createMany({
    data: ordered.map((c) => ({
      id: categoryIds.get(c.id)!,
      versionId: toVersionId,
      parentId: c.parentId ? categoryIds.get(c.parentId)! : null,
      label: c.label,
      slug: c.slug,
      position: c.position,
      icon: c.icon,
      collapsed: c.collapsed,
      description: c.description,
    })),
  });

  const docs = await tx.doc.findMany({
    where: { versionId: fromVersionId },
    include: { publishedRevision: true },
  });
  const docIds = new Map(docs.map((d) => [d.id, randomUUID()]));
  const now = new Date();
  await tx.doc.createMany({
    data: docs.map((d) => ({
      id: docIds.get(d.id)!,
      versionId: toVersionId,
      categoryId: d.categoryId ? categoryIds.get(d.categoryId)! : null,
      slug: d.slug,
      position: d.position,
      title: d.title,
      status: d.status === DocStatus.ARCHIVED ? DocStatus.ARCHIVED : d.status,
      source: d.source,
      // So với publishedAt = now ở dưới: bản nháp khác bản xuất bản phải "mới hơn" để Studio
      // vẫn báo còn thay đổi chưa xuất bản.
      sourceUpdatedAt: !d.publishedRevision
        ? d.sourceUpdatedAt
        : d.source === d.publishedRevision.source
          ? now
          : new Date(now.getTime() + 1),
      sourceUpdatedById: d.sourceUpdatedById,
    })),
  });

  const published = docs.filter((d) => d.publishedRevision);
  const revisionIds = new Map(published.map((d) => [d.id, randomUUID()]));
  await tx.docRevision.createMany({
    data: published.map((d) => {
      const r = d.publishedRevision!;
      return {
        id: revisionIds.get(d.id)!,
        docId: docIds.get(d.id)!,
        number: 1,
        title: r.title,
        source: r.source,
        html: r.html,
        toc: r.toc as Prisma.InputJsonValue,
        frontmatter: r.frontmatter as Prisma.InputJsonValue,
        readingTime: r.readingTime,
        wordCount: r.wordCount,
        message: 'Sao chép khi tạo phiên bản mới',
        authorId: userId,
      };
    }),
  });
  for (const d of published) {
    await tx.doc.update({
      where: { id: docIds.get(d.id)! },
      data: { publishedRevisionId: revisionIds.get(d.id)!, publishedAt: now, publishAt: d.publishAt },
    });
  }
}
