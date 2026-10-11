import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FrontmatterError,
  parseFrontmatter,
  setFrontmatterField,
  slugify,
} from '@docshub/markdown';
import type { AuthUser } from '../common/auth-user.js';
import { uniqueSlug } from '../common/unique-slug.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { CourseRole, DocStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateDocDto,
  PublishDocDto,
  SaveDraftDto,
  UpdateDocDto,
} from './dto/content.dto.js';
import { SearchIndexService } from '../search/search-index.service.js';
import { readerBasePath, RenderService } from './render.service.js';
import { flattenDocs } from './tree.js';
import { frozenError, TreeService } from './tree.service.js';

/** Khoá mềm hết hạn nếu editor không gia hạn (autosave hoặc gọi lại /lock) trong 2 phút. */
const LOCK_TTL_MS = 2 * 60 * 1000;

const docSummarySelect = {
  id: true,
  versionId: true,
  categoryId: true,
  slug: true,
  position: true,
  title: true,
  status: true,
  sourceUpdatedAt: true,
  publishedRevisionId: true,
  publishedAt: true,
  publishAt: true,
} satisfies Prisma.DocSelect;

type DocWithVersion = Awaited<ReturnType<CourseAccessService['requireDoc']>>['doc'];

@Injectable()
export class DocsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly tree: TreeService,
    private readonly renderer: RenderService,
    private readonly search: SearchIndexService,
  ) {}

  async create(user: AuthUser, versionId: string, dto: CreateDocDto) {
    const { version } = await this.access.requireVersion(user, versionId, CourseRole.EDITOR);
    if (version.frozenAt) throw frozenError();
    const categoryId = dto.categoryId ?? null;
    if (categoryId) {
      const count = await this.prisma.category.count({ where: { id: categoryId, versionId } });
      if (count === 0) throw new BadRequestException('Nhóm bài không thuộc phiên bản này');
    }

    const source = dto.source ?? setFrontmatterField('', 'title', dto.title);
    const meta = extractDraftMeta(source);
    const slug = await this.pickSlug(versionId, categoryId, dto.slug ?? meta.slug, dto.title);

    return this.prisma.doc.create({
      data: {
        versionId,
        categoryId,
        slug,
        title: meta.title ?? dto.title,
        source,
        position: meta.position ?? (await this.tree.nextPosition(versionId, categoryId)),
        sourceUpdatedById: user.id,
      },
      select: docSummarySelect,
    });
  }

  /** Dữ liệu cho màn hình editor: bản nháp, trạng thái xuất bản, ai đang giữ khoá. */
  async getForEditor(user: AuthUser, docId: string) {
    const { doc, role } = await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    const [published, lockHolder, tree] = await Promise.all([
      doc.publishedRevisionId
        ? this.prisma.docRevision.findUnique({
            where: { id: doc.publishedRevisionId },
            select: { id: true, number: true, createdAt: true },
          })
        : null,
      this.activeLockHolder(doc, user),
      this.tree.studioTree(doc.versionId),
    ]);
    const path = flattenDocs(tree).find((d) => d.id === doc.id)?.path ?? doc.slug;

    return {
      id: doc.id,
      versionId: doc.versionId,
      categoryId: doc.categoryId,
      slug: doc.slug,
      path,
      readerUrl: `${readerBasePath(doc.version.course.slug, doc.version.slug)}/${path}`,
      title: doc.title,
      status: doc.status,
      source: doc.source,
      sourceUpdatedAt: doc.sourceUpdatedAt,
      sourceUpdatedById: doc.sourceUpdatedById,
      publishedRevision: published,
      publishedAt: doc.publishedAt,
      publishAt: doc.publishAt,
      hasUnpublishedChanges: hasUnpublishedChanges(doc),
      versionFrozen: doc.version.frozenAt !== null,
      lockedBy: lockHolder,
      role,
    };
  }

  /**
   * Lưu bản nháp. Autosave chỉ ghi bản nháp; `createRevision` (Ctrl+S) tạo thêm revision.
   * Đồng bộ title, slug, sidebar_position từ frontmatter vào cây nội dung.
   */
  async saveDraft(user: AuthUser, docId: string, dto: SaveDraftDto) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    assertEditable(doc);
    if (
      dto.baseUpdatedAt &&
      doc.sourceUpdatedAt.getTime() > dto.baseUpdatedAt.getTime() &&
      doc.sourceUpdatedById !== user.id
    ) {
      throw new ConflictException({
        message: 'Bài vừa được người khác cập nhật. Hãy tải lại để không ghi đè thay đổi của họ.',
        sourceUpdatedAt: doc.sourceUpdatedAt,
        sourceUpdatedById: doc.sourceUpdatedById,
      });
    }

    const meta = extractDraftMeta(dto.source);
    if (meta.slug && meta.slug !== doc.slug) {
      await this.assertSlugFree(doc.versionId, doc.categoryId, meta.slug, doc.id);
    }
    const changed = dto.source !== doc.source;
    const now = new Date();
    const updated = await this.prisma.doc.update({
      where: { id: doc.id },
      data: {
        source: dto.source,
        title: meta.title ?? doc.title,
        slug: meta.slug ?? doc.slug,
        position: meta.position ?? doc.position,
        ...(changed
          ? {
              sourceUpdatedAt: now,
              sourceUpdatedById: user.id,
              status: DocStatus.DRAFT,
            }
          : {}),
        lockedById: user.id,
        lockedAt: now,
      },
      select: docSummarySelect,
    });

    if (!dto.createRevision) return { doc: updated, revision: null, warnings: [] };
    const { revision, warnings } = await this.snapshot(
      { ...doc, source: dto.source, title: updated.title },
      user,
      dto.message,
    );
    return { doc: updated, revision, warnings };
  }

  /** Biên tập viên gửi bài cho chủ khoá duyệt. */
  async submitForReview(user: AuthUser, docId: string) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    assertEditable(doc);
    if (doc.status === DocStatus.IN_REVIEW) {
      throw new ConflictException('Bài đang chờ duyệt');
    }
    if (!hasUnpublishedChanges(doc)) {
      throw new BadRequestException('Bài không có thay đổi nào so với bản đã xuất bản');
    }
    const { revision, warnings } = await this.snapshot(doc, user, 'Gửi duyệt');
    const updated = await this.prisma.doc.update({
      where: { id: doc.id },
      data: { status: DocStatus.IN_REVIEW },
      select: docSummarySelect,
    });
    return { doc: updated, revision, warnings };
  }

  /** Xuất bản bản nháp hiện tại. Học viên thấy ngay, hoặc từ `publishAt` nếu hẹn giờ. */
  async publish(user: AuthUser, docId: string, dto: PublishDocDto) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.OWNER);
    assertEditable(doc);
    const { revision, warnings } = await this.snapshot(doc, user, dto.message ?? 'Xuất bản');
    const updated = await this.prisma.doc.update({
      where: { id: doc.id },
      data: {
        publishedRevisionId: revision.id,
        publishedAt: new Date(),
        publishAt: dto.publishAt ?? null,
        status: DocStatus.PUBLISHED,
      },
      select: docSummarySelect,
    });
    this.search.scheduleVersion(doc.versionId);
    return { doc: updated, revision, warnings };
  }

  async unpublish(user: AuthUser, docId: string) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.OWNER);
    if (doc.version.frozenAt) throw frozenError();
    this.search.scheduleVersion(doc.versionId);
    return this.prisma.doc.update({
      where: { id: doc.id },
      data: {
        publishedRevisionId: null,
        publishedAt: null,
        publishAt: null,
        status: doc.status === DocStatus.ARCHIVED ? DocStatus.ARCHIVED : DocStatus.DRAFT,
      },
      select: docSummarySelect,
    });
  }

  /** Lưu trữ: ẩn bài với học viên nhưng giữ nguyên nội dung và lịch sử. */
  async setArchived(user: AuthUser, docId: string, archived: boolean) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.OWNER);
    if (doc.version.frozenAt) throw frozenError();
    const restoredStatus =
      doc.publishedRevisionId && !hasUnpublishedChanges(doc)
        ? DocStatus.PUBLISHED
        : DocStatus.DRAFT;
    this.search.scheduleVersion(doc.versionId);
    return this.prisma.doc.update({
      where: { id: doc.id },
      data: { status: archived ? DocStatus.ARCHIVED : restoredStatus },
      select: docSummarySelect,
    });
  }

  async update(user: AuthUser, docId: string, dto: UpdateDocDto) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    assertEditable(doc);
    if (!dto.slug || dto.slug === doc.slug) return this.summary(doc.id);
    await this.assertSlugFree(doc.versionId, doc.categoryId, dto.slug, doc.id);
    const hasSlugKey = 'slug' in safeFrontmatter(doc.source);
    this.search.scheduleVersion(doc.versionId);
    return this.prisma.doc.update({
      where: { id: doc.id },
      data: {
        slug: dto.slug,
        // Frontmatter có khai báo slug thì sửa theo, để lần lưu sau không đổi ngược lại.
        ...(hasSlugKey ? { source: setFrontmatterField(doc.source, 'slug', dto.slug) } : {}),
      },
      select: docSummarySelect,
    });
  }

  async remove(user: AuthUser, docId: string) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.OWNER);
    if (doc.version.frozenAt) throw frozenError();
    await this.prisma.doc.delete({ where: { id: doc.id } });
    this.search.scheduleVersion(doc.versionId);
  }

  async listRevisions(user: AuthUser, docId: string) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    const revisions = await this.prisma.docRevision.findMany({
      where: { docId },
      select: {
        id: true,
        number: true,
        title: true,
        message: true,
        readingTime: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
      orderBy: { number: 'desc' },
    });
    return revisions.map((r) => ({ ...r, isPublished: r.id === doc.publishedRevisionId }));
  }

  async getRevision(user: AuthUser, docId: string, number: number) {
    await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    const revision = await this.prisma.docRevision.findUnique({
      where: { docId_number: { docId, number } },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!revision) throw new NotFoundException(`Không có bản #${number}`);
    return revision;
  }

  /** Khôi phục: chép nội dung bản cũ vào bản nháp và ghi thành revision mới (không xoá lịch sử). */
  async restoreRevision(user: AuthUser, docId: string, number: number) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    assertEditable(doc);
    const target = await this.prisma.docRevision.findUnique({
      where: { docId_number: { docId, number } },
      select: { source: true, title: true },
    });
    if (!target) throw new NotFoundException(`Không có bản #${number}`);

    const updated = await this.prisma.doc.update({
      where: { id: doc.id },
      data: {
        source: target.source,
        title: target.title,
        sourceUpdatedAt: new Date(),
        sourceUpdatedById: user.id,
        status: DocStatus.DRAFT,
      },
      select: docSummarySelect,
    });
    const { revision, warnings } = await this.snapshot(
      { ...doc, source: target.source, title: target.title },
      user,
      `Khôi phục từ bản #${number}`,
    );
    return { doc: updated, revision, warnings };
  }

  /** Giữ khoá mềm khi mở editor. Người khác đang giữ thì trả về họ, trừ khi `force`. */
  async lock(user: AuthUser, docId: string, force = false) {
    const { doc } = await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    const holder = await this.activeLockHolder(doc, user);
    if (holder && !force) return { acquired: false, lockedBy: holder };
    await this.prisma.doc.update({
      where: { id: doc.id },
      data: { lockedById: user.id, lockedAt: new Date() },
    });
    return { acquired: true, lockedBy: null };
  }

  async unlock(user: AuthUser, docId: string) {
    await this.access.requireDoc(user, docId, CourseRole.EDITOR);
    await this.prisma.doc.updateMany({
      where: { id: docId, lockedById: user.id },
      data: { lockedById: null, lockedAt: null },
    });
  }

  /**
   * Render bản nháp và ghi revision. Nếu nội dung trùng revision mới nhất thì dùng lại,
   * để bấm lưu/xuất bản nhiều lần không sinh revision rỗng.
   */
  private async snapshot(
    doc: Pick<DocWithVersion, 'id' | 'source' | 'title' | 'versionId' | 'version'>,
    user: AuthUser,
    message?: string,
  ) {
    const rendered = await this.renderer.render(doc.source, {
      versionId: doc.versionId,
      courseSlug: doc.version.course.slug,
      versionSlug: doc.version.slug,
    });
    const latest = await this.prisma.docRevision.findFirst({
      where: { docId: doc.id },
      orderBy: { number: 'desc' },
      select: { id: true, number: true, source: true, createdAt: true },
    });
    if (latest && latest.source === doc.source) {
      return {
        revision: { id: latest.id, number: latest.number, createdAt: latest.createdAt },
        warnings: rendered.warnings,
      };
    }

    const revision = await this.prisma.docRevision.create({
      data: {
        docId: doc.id,
        number: (latest?.number ?? 0) + 1,
        title: rendered.title ?? doc.title,
        source: doc.source,
        html: rendered.html,
        toc: rendered.toc as unknown as Prisma.InputJsonValue,
        frontmatter: rendered.frontmatter as Prisma.InputJsonValue,
        readingTime: rendered.readingTime,
        wordCount: rendered.wordCount,
        message,
        authorId: user.id,
      },
      select: { id: true, number: true, createdAt: true },
    });
    return { revision, warnings: rendered.warnings };
  }

  private async activeLockHolder(
    doc: { lockedById: string | null; lockedAt: Date | null },
    user: AuthUser,
  ) {
    if (
      !doc.lockedById ||
      doc.lockedById === user.id ||
      !doc.lockedAt ||
      Date.now() - doc.lockedAt.getTime() > LOCK_TTL_MS
    ) {
      return null;
    }
    const holder = await this.prisma.user.findUnique({
      where: { id: doc.lockedById },
      select: { id: true, name: true },
    });
    return holder ? { ...holder, lockedAt: doc.lockedAt } : null;
  }

  private summary(docId: string) {
    return this.prisma.doc.findUniqueOrThrow({ where: { id: docId }, select: docSummarySelect });
  }

  private async pickSlug(
    versionId: string,
    categoryId: string | null,
    requested: string | undefined,
    title: string,
  ) {
    if (requested) return this.assertSlugFree(versionId, categoryId, requested);
    return uniqueSlug(title, (s) => this.tree.isSlugTaken(versionId, categoryId, s));
  }

  private async assertSlugFree(
    versionId: string,
    categoryId: string | null,
    slug: string,
    excludeDocId?: string,
  ) {
    if (await this.tree.isSlugTaken(versionId, categoryId, slug, { docId: excludeDocId })) {
      throw new ConflictException(`Đường dẫn "${slug}" đã được dùng trong nhóm này`);
    }
    return slug;
  }
}

function assertEditable(doc: Pick<DocWithVersion, 'status' | 'version'>) {
  if (doc.version.frozenAt) throw frozenError();
  if (doc.status === DocStatus.ARCHIVED) {
    throw new ConflictException('Bài đã lưu trữ, hãy bỏ lưu trữ trước khi chỉnh sửa');
  }
}

function hasUnpublishedChanges(doc: { publishedAt: Date | null; sourceUpdatedAt: Date }) {
  return doc.publishedAt === null || doc.sourceUpdatedAt > doc.publishedAt;
}

/** Đọc nhanh title/slug/sidebar_position từ bản nháp mà không render toàn bộ. */
export function extractDraftMeta(source: string): {
  title: string | null;
  slug?: string;
  position?: number;
} {
  let data: ReturnType<typeof parseFrontmatter>['data'];
  let body: string;
  try {
    ({ data, body } = parseFrontmatter(source));
  } catch (error) {
    if (error instanceof FrontmatterError) {
      throw new BadRequestException({
        message: error.message,
        line: error.line ?? null,
        error: 'FrontmatterError',
      });
    }
    throw error;
  }

  const heading = /^#[ \t]+(.+?)[ \t#]*$/m.exec(body)?.[1]?.trim();
  let slug: string | undefined;
  if (data.slug !== undefined) {
    slug = slugify(data.slug.split('/').filter(Boolean).at(-1) ?? '');
    if (!slug) throw new BadRequestException('Frontmatter "slug" không hợp lệ');
  }
  const position =
    data.sidebar_position === undefined
      ? undefined
      : Math.max(0, Math.round(data.sidebar_position));
  return { title: data.title?.trim() || heading || null, slug, position };
}

function safeFrontmatter(source: string) {
  try {
    return parseFrontmatter(source).data;
  } catch {
    return {};
  }
}
