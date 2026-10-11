import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { uniqueSlug } from '../common/unique-slug.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import { CourseRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SearchIndexService } from '../search/search-index.service.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/content.dto.js';
import { categoryDepth } from './tree.js';
import { frozenError, MAX_CATEGORY_DEPTH, TreeService } from './tree.service.js';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly tree: TreeService,
    private readonly search: SearchIndexService,
  ) {}

  async create(user: AuthUser, versionId: string, dto: CreateCategoryDto) {
    const { version } = await this.access.requireVersion(user, versionId, CourseRole.EDITOR);
    if (version.frozenAt) throw frozenError();
    const parentId = dto.parentId ?? null;

    if (parentId) {
      const categories = await this.prisma.category.findMany({
        where: { versionId },
        select: { id: true, parentId: true },
      });
      const parents = new Map(categories.map((c) => [c.id, c.parentId]));
      if (!parents.has(parentId)) {
        throw new BadRequestException('Nhóm bài cha không thuộc phiên bản này');
      }
      if (categoryDepth(parentId, parents) >= MAX_CATEGORY_DEPTH) {
        throw new BadRequestException(`Nhóm bài chỉ được lồng tối đa ${MAX_CATEGORY_DEPTH} cấp`);
      }
    }

    const slug = dto.slug
      ? await this.assertSlugFree(versionId, parentId, dto.slug)
      : await uniqueSlug(dto.label, (s) => this.tree.isSlugTaken(versionId, parentId, s), 'nhom');

    return this.prisma.category.create({
      data: {
        versionId,
        parentId,
        label: dto.label,
        slug,
        icon: dto.icon,
        collapsed: dto.collapsed ?? false,
        description: dto.description,
        position: await this.tree.nextPosition(versionId, parentId),
      },
    });
  }

  async update(user: AuthUser, categoryId: string, dto: UpdateCategoryDto) {
    const { category } = await this.access.requireCategory(user, categoryId, CourseRole.EDITOR);
    if (category.version.frozenAt) throw frozenError();
    if (dto.slug && dto.slug !== category.slug) {
      await this.assertSlugFree(category.versionId, category.parentId, dto.slug, categoryId);
    }
    // Đổi slug nhóm làm đổi đường dẫn mọi bài bên trong.
    if (dto.slug && dto.slug !== category.slug) this.search.scheduleVersion(category.versionId);
    return this.prisma.category.update({ where: { id: categoryId }, data: dto });
  }

  /** Chỉ xoá được nhóm bài rỗng, để không mất bài vì bấm nhầm. */
  async remove(user: AuthUser, categoryId: string) {
    const { category } = await this.access.requireCategory(user, categoryId, CourseRole.EDITOR);
    if (category.version.frozenAt) throw frozenError();
    const [children, docs] = await Promise.all([
      this.prisma.category.count({ where: { parentId: categoryId } }),
      this.prisma.doc.count({ where: { categoryId } }),
    ]);
    if (children + docs > 0) {
      throw new ConflictException('Nhóm bài còn nội dung, hãy chuyển hoặc xoá bài bên trong trước');
    }
    await this.prisma.category.delete({ where: { id: categoryId } });
  }

  private async assertSlugFree(
    versionId: string,
    parentId: string | null,
    slug: string,
    excludeCategoryId?: string,
  ) {
    if (await this.tree.isSlugTaken(versionId, parentId, slug, { categoryId: excludeCategoryId })) {
      throw new ConflictException(`Đường dẫn "${slug}" đã được dùng trong nhóm này`);
    }
    return slug;
  }
}
