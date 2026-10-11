import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { parseFrontmatter, setFrontmatterField } from '@docshub/markdown';
import type { AuthUser } from '../common/auth-user.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import { CourseRole, DocStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchIndexService } from '../search/search-index.service.js';
import type { ReorderTreeDto } from './dto/content.dto.js';
import {
  buildTree,
  categoryDepth,
  findCategoryCycle,
  type TreeCategoryInput,
  type TreeNode,
} from './tree.js';

/** PRD F-ORG-01: category lồng tối đa 3 cấp. */
export const MAX_CATEGORY_DEPTH = 3;

const categorySelect = {
  id: true,
  parentId: true,
  label: true,
  slug: true,
  position: true,
  icon: true,
  collapsed: true,
  description: true,
} as const;

/** Bài học viên được đọc: đã xuất bản, không lưu trữ, đã tới giờ mở. */
export function isVisibleToLearners(
  doc: { publishedRevisionId: string | null; status: DocStatus; publishAt: Date | null },
  now = new Date(),
) {
  return (
    doc.publishedRevisionId !== null &&
    doc.status !== DocStatus.ARCHIVED &&
    (doc.publishAt === null || doc.publishAt <= now)
  );
}

@Injectable()
export class TreeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly search: SearchIndexService,
  ) {}

  /** Cây cho Studio: mọi bài kèm trạng thái, kể cả bản nháp và bài lưu trữ. */
  async studioTree(versionId: string, options: { includeArchived?: boolean } = {}) {
    const [categories, docs] = await Promise.all([
      this.prisma.category.findMany({ where: { versionId }, select: categorySelect }),
      this.prisma.doc.findMany({
        where: {
          versionId,
          ...(options.includeArchived === false ? { status: { not: DocStatus.ARCHIVED } } : {}),
        },
        select: {
          id: true,
          categoryId: true,
          slug: true,
          position: true,
          title: true,
          status: true,
          publishedRevisionId: true,
          publishedAt: true,
          publishAt: true,
          sourceUpdatedAt: true,
        },
      }),
    ]);
    return buildTree(
      categories,
      docs.map((doc) => ({
        id: doc.id,
        categoryId: doc.categoryId,
        slug: doc.slug,
        position: doc.position,
        label: doc.title,
        meta: {
          status: doc.status,
          isPublished: doc.publishedRevisionId !== null,
          hasUnpublishedChanges:
            doc.publishedAt === null || doc.sourceUpdatedAt > doc.publishedAt,
          publishAt: doc.publishAt,
        },
      })),
    );
  }

  /** Cây cho học viên: chỉ bài đang hiển thị, nhãn lấy từ bản đã xuất bản, bỏ category rỗng. */
  async learnerTree(versionId: string): Promise<TreeNode[]> {
    const now = new Date();
    const [categories, docs] = await Promise.all([
      this.prisma.category.findMany({ where: { versionId }, select: categorySelect }),
      this.prisma.doc.findMany({
        where: {
          versionId,
          publishedRevisionId: { not: null },
          status: { not: DocStatus.ARCHIVED },
          OR: [{ publishAt: null }, { publishAt: { lte: now } }],
        },
        select: {
          id: true,
          categoryId: true,
          slug: true,
          position: true,
          publishedRevision: { select: { title: true, frontmatter: true, readingTime: true } },
        },
      }),
    ]);
    return buildTree(
      categories,
      docs.map((doc) => {
        const frontmatter = (doc.publishedRevision?.frontmatter ?? {}) as {
          sidebar_label?: string;
        };
        return {
          id: doc.id,
          categoryId: doc.categoryId,
          slug: doc.slug,
          position: doc.position,
          label: frontmatter.sidebar_label ?? doc.publishedRevision?.title ?? doc.slug,
          meta: { readingTime: doc.publishedRevision?.readingTime },
        };
      }),
      { pruneEmpty: true },
    );
  }

  /**
   * Áp dụng kết quả kéo-thả. Kiểm tra mọi id thuộc version, không tạo vòng lặp,
   * không vượt 3 cấp và không trùng slug trong cùng cấp.
   */
  async reorder(user: AuthUser, versionId: string, dto: ReorderTreeDto) {
    const { version } = await this.access.requireVersion(user, versionId, CourseRole.EDITOR);
    if (version.frozenAt) throw frozenError();

    const [categories, docs] = await Promise.all([
      this.prisma.category.findMany({ where: { versionId }, select: categorySelect }),
      this.prisma.doc.findMany({
        where: { versionId },
        select: { id: true, categoryId: true, slug: true, position: true, source: true },
      }),
    ]);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const docById = new Map(docs.map((d) => [d.id, d]));

    const parents = new Map(categories.map((c) => [c.id, c.parentId]));
    for (const move of dto.categories ?? []) {
      if (!categoryById.has(move.id)) throw notInVersion('Nhóm bài', move.id);
      if (move.parentId && !categoryById.has(move.parentId)) {
        throw notInVersion('Nhóm bài cha', move.parentId);
      }
      parents.set(move.id, move.parentId);
    }
    if (findCategoryCycle(parents)) {
      throw new BadRequestException('Không thể đặt một nhóm bài vào bên trong chính nó');
    }
    for (const id of parents.keys()) {
      if (categoryDepth(id, parents) > MAX_CATEGORY_DEPTH) {
        throw new BadRequestException(`Nhóm bài chỉ được lồng tối đa ${MAX_CATEGORY_DEPTH} cấp`);
      }
    }
    for (const move of dto.docs ?? []) {
      if (!docById.has(move.id)) throw notInVersion('Bài viết', move.id);
      if (move.categoryId && !categoryById.has(move.categoryId)) {
        throw notInVersion('Nhóm bài', move.categoryId);
      }
    }

    // Kiểm tra trùng slug trong từng cấp sau khi di chuyển.
    const finalCategories: TreeCategoryInput[] = categories.map((c) => ({
      ...c,
      parentId: parents.get(c.id) ?? null,
    }));
    const docParent = new Map(docs.map((d) => [d.id, d.categoryId]));
    for (const move of dto.docs ?? []) docParent.set(move.id, move.categoryId);
    assertNoSlugClash(
      [
        ...finalCategories.map((c) => ({ parent: c.parentId, slug: c.slug })),
        ...docs.map((d) => ({ parent: docParent.get(d.id) ?? null, slug: d.slug })),
      ],
    );

    await this.prisma.$transaction([
      ...(dto.categories ?? []).map((move) =>
        this.prisma.category.update({
          where: { id: move.id },
          data: { parentId: move.parentId, position: move.position },
        }),
      ),
      ...(dto.docs ?? []).map((move) =>
        this.prisma.doc.update({
          where: { id: move.id },
          data: {
            categoryId: move.categoryId,
            position: move.position,
            // Giữ frontmatter khớp với cây nếu tác giả có khai báo sidebar_position.
            source: syncSidebarPosition(docById.get(move.id)!.source, move.position),
          },
        }),
      ),
    ]);
    this.search.scheduleVersion(versionId);
    return this.studioTree(versionId);
  }

  /**
   * Vị trí cuối cùng trong một cấp. Category và bài cùng cấp dùng chung một dãy vị trí,
   * nên phải xét cả hai bảng, nếu không phần tử mới sẽ trùng vị trí và bị xếp theo tên.
   */
  async nextPosition(versionId: string, parentId: string | null) {
    const [categories, docs] = await Promise.all([
      this.prisma.category.aggregate({ where: { versionId, parentId }, _max: { position: true } }),
      this.prisma.doc.aggregate({ where: { versionId, categoryId: parentId }, _max: { position: true } }),
    ]);
    return Math.max(categories._max.position ?? -1, docs._max.position ?? -1) + 1;
  }

  /** Slug đã được dùng bởi category hoặc bài khác trong cùng cấp chưa. */
  async isSlugTaken(
    versionId: string,
    parentId: string | null,
    slug: string,
    exclude?: { categoryId?: string; docId?: string },
  ) {
    const [categories, docs] = await Promise.all([
      this.prisma.category.count({
        where: { versionId, parentId, slug, id: exclude?.categoryId ? { not: exclude.categoryId } : undefined },
      }),
      this.prisma.doc.count({
        where: { versionId, categoryId: parentId, slug, id: exclude?.docId ? { not: exclude.docId } : undefined },
      }),
    ]);
    return categories + docs > 0;
  }
}

function syncSidebarPosition(source: string, position: number): string {
  try {
    if (!('sidebar_position' in parseFrontmatter(source).data)) return source;
    return setFrontmatterField(source, 'sidebar_position', position);
  } catch {
    // Frontmatter đang lỗi thì không đụng vào, tác giả sẽ thấy lỗi khi lưu.
    return source;
  }
}

function assertNoSlugClash(items: Array<{ parent: string | null; slug: string }>) {
  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.parent ?? ''}/${item.slug}`;
    if (seen.has(key)) {
      throw new ConflictException(`Trùng đường dẫn "${item.slug}" trong cùng một nhóm bài`);
    }
    seen.add(key);
  }
}

function notInVersion(kind: string, id: string) {
  return new BadRequestException(`${kind} ${id} không thuộc phiên bản này`);
}

export function frozenError() {
  return new ConflictException('Phiên bản đã khoá, không thể chỉnh sửa nội dung');
}
