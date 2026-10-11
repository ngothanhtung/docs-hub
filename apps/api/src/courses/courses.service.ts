import { isUUID } from 'class-validator';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { slugify } from '@docshub/markdown';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { uniqueSlug } from '../common/unique-slug.js';
import { CourseRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CourseAccessService } from './course-access.service.js';
import type { CreateCourseDto, UpdateCourseDto } from './dto/course.dto.js';

const versionSummary = { id: true, slug: true, label: true, isCurrent: true, frozenAt: true } as const;

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
    private readonly audit: AuditService,
  ) {}

  /** Khoá học người dùng tham gia (admin thấy tất cả), kèm vai trò và version hiện hành. */
  async listForUser(user: AuthUser) {
    const courses = await this.prisma.course.findMany({
      where:
        user.systemRole === 'ADMIN'
          ? undefined
          : {
              members: { some: { userId: user.id } },
              OR: [
                { archivedAt: null },
                { members: { some: { userId: user.id, role: CourseRole.OWNER } } },
              ],
            },
      include: {
        members: { where: { userId: user.id }, select: { role: true } },
        versions: { where: { isCurrent: true }, select: versionSummary },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return courses.map(({ members, versions, ...course }) => ({
      ...course,
      role: user.systemRole === 'ADMIN' ? CourseRole.OWNER : (members[0]?.role ?? null),
      currentVersion: versions[0] ?? null,
    }));
  }

  async create(user: AuthUser, dto: CreateCourseDto) {
    if (user.systemRole !== 'ADMIN' && user.systemRole !== 'INSTRUCTOR') {
      throw new ForbiddenException('Chỉ giảng viên hoặc admin được tạo khoá học');
    }
    const slug = dto.slug
      ? await this.assertSlugFree(dto.slug)
      : await uniqueSlug(dto.title, (s) => this.slugTaken(s), 'khoa-hoc');
    const versionLabel = dto.versionLabel ?? String(new Date().getFullYear());

    return this.prisma.course.create({
      data: {
        slug,
        title: dto.title,
        description: dto.description,
        coverUrl: dto.coverUrl,
        ownerId: user.id,
        members: { create: { userId: user.id, role: CourseRole.OWNER } },
        versions: {
          create: { label: versionLabel, slug: slugify(versionLabel) || 'v1', isCurrent: true },
        },
      },
      include: { versions: { select: versionSummary } },
    });
  }

  /** Tìm theo id hoặc slug. Học viên chỉ thấy khoá mình được ghi danh. */
  async get(user: AuthUser, idOrSlug: string) {
    const course = await this.findByIdOrSlug(idOrSlug);
    const { role } = await this.access.requireCourse(user, course.id, CourseRole.LEARNER);
    const versions = await this.prisma.version.findMany({
      where: { courseId: course.id },
      select: versionSummary,
      orderBy: { createdAt: 'desc' },
    });
    return { ...course, role, versions };
  }

  async update(user: AuthUser, courseId: string, dto: UpdateCourseDto) {
    const { course } = await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    if (dto.slug && dto.slug !== course.slug) await this.assertSlugFree(dto.slug);
    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        coverUrl: dto.coverUrl,
        theme: dto.theme,
        // Lưu chữ thường để so sánh và hiển thị nhất quán.
        primaryColor: dto.primaryColor?.toLowerCase() ?? dto.primaryColor,
      },
    });
  }

  async setArchived(user: AuthUser, courseId: string, archived: boolean) {
    await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: { archivedAt: archived ? new Date() : null },
    });
    await this.audit.record({
      actorId: user.id,
      action: archived ? 'course.archive' : 'course.unarchive',
      targetType: 'course',
      targetId: courseId,
      summary: `${archived ? 'Lưu trữ' : 'Khôi phục'} khoá học "${course.title}"`,
    });
    return course;
  }

  /** Xoá hẳn khoá học và toàn bộ nội dung. Chỉ admin. */
  async remove(user: AuthUser, courseId: string) {
    const course = await this.prisma.course.delete({ where: { id: courseId } });
    await this.audit.record({
      actorId: user.id,
      action: 'course.delete',
      targetType: 'course',
      targetId: courseId,
      summary: `Xoá khoá học "${course.title}" (${course.slug})`,
    });
  }

  /** Chuyển quyền chủ khoá cho người khác (admin). Chủ cũ vẫn ở lại khoá với vai trò biên tập. */
  async transferOwner(user: AuthUser, courseId: string, newOwnerId: string) {
    const [course, owner] = await Promise.all([
      this.prisma.course.findUnique({ where: { id: courseId } }),
      this.prisma.user.findUnique({ where: { id: newOwnerId } }),
    ]);
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    if (!owner || !owner.isActive) throw new BadRequestException('Người nhận không tồn tại hoặc đã bị khoá');
    if (course.ownerId === newOwnerId) return course;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.courseMember.updateMany({
        where: { courseId, userId: course.ownerId, role: CourseRole.OWNER },
        data: { role: CourseRole.EDITOR },
      });
      await tx.courseMember.upsert({
        where: { courseId_userId: { courseId, userId: newOwnerId } },
        create: { courseId, userId: newOwnerId, role: CourseRole.OWNER },
        update: { role: CourseRole.OWNER },
      });
      return tx.course.update({ where: { id: courseId }, data: { ownerId: newOwnerId } });
    });
    await this.audit.record({
      actorId: user.id,
      action: 'course.transfer',
      targetType: 'course',
      targetId: courseId,
      summary: `Chuyển chủ khoá "${course.title}" cho ${owner.email}`,
      meta: { from: course.ownerId, to: newOwnerId },
    });
    return updated;
  }

  /**
   * Version học viên đọc mặc định: version của lớp mình (nếu có), không thì version hiện hành.
   */
  async defaultVersionFor(user: AuthUser, courseId: string) {
    const member = await this.prisma.courseMember.findUnique({
      where: { courseId_userId: { courseId, userId: user.id } },
      select: { cohort: { select: { versionId: true } } },
    });
    const cohortVersionId = member?.cohort?.versionId;
    const version = await this.prisma.version.findFirst({
      where: cohortVersionId ? { id: cohortVersionId } : { courseId, isCurrent: true },
    });
    if (!version) throw new NotFoundException('Khoá học chưa có phiên bản nào');
    return version;
  }

  async findByIdOrSlug(idOrSlug: string) {
    const course = await this.prisma.course.findUnique({
      where: isUUID(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug },
    });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    return course;
  }

  private async slugTaken(slug: string) {
    return (await this.prisma.course.count({ where: { slug } })) > 0;
  }

  private async assertSlugFree(slug: string) {
    if (await this.slugTaken(slug)) throw new ConflictException('Slug khoá học đã được dùng');
    return slug;
  }
}
