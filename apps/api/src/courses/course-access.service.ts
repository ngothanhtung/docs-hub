import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { CourseRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

const RANK: Record<CourseRole, number> = { LEARNER: 1, EDITOR: 2, OWNER: 3 };

export function hasCourseRole(role: CourseRole | null, min: CourseRole): boolean {
  return role !== null && RANK[role] >= RANK[min];
}

/**
 * Phân quyền cấp khoá học. Admin hệ thống được coi là OWNER của mọi khoá.
 * Người không thuộc khoá nhận 404 thay vì 403 để không lộ khoá tồn tại.
 */
@Injectable()
export class CourseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getRole(user: AuthUser, courseId: string): Promise<CourseRole | null> {
    if (user.systemRole === 'ADMIN') return CourseRole.OWNER;
    const member = await this.prisma.courseMember.findUnique({
      where: { courseId_userId: { courseId, userId: user.id } },
      select: { role: true },
    });
    return member?.role ?? null;
  }

  async requireCourse(user: AuthUser, courseId: string, min: CourseRole) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Không tìm thấy khoá học');
    const role = await this.assertRole(user, course.id, min);
    // Khoá đã lưu trữ chỉ còn chủ khoá thấy.
    if (course.archivedAt && !hasCourseRole(role, CourseRole.OWNER)) {
      throw new NotFoundException('Không tìm thấy khoá học');
    }
    return { course, role };
  }

  async requireVersion(user: AuthUser, versionId: string, min: CourseRole) {
    const version = await this.prisma.version.findUnique({
      where: { id: versionId },
      include: { course: { select: { id: true, slug: true, archivedAt: true } } },
    });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản');
    const role = await this.assertRole(user, version.courseId, min);
    if (version.course.archivedAt && !hasCourseRole(role, CourseRole.OWNER)) {
      throw new NotFoundException('Không tìm thấy phiên bản');
    }
    return { version, role };
  }

  async requireCategory(user: AuthUser, categoryId: string, min: CourseRole) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { version: { select: { courseId: true, frozenAt: true } } },
    });
    if (!category) throw new NotFoundException('Không tìm thấy nhóm bài');
    const role = await this.assertRole(user, category.version.courseId, min);
    return { category, role };
  }

  async requireDoc(user: AuthUser, docId: string, min: CourseRole) {
    const doc = await this.prisma.doc.findUnique({
      where: { id: docId },
      include: {
        version: {
          select: {
            id: true,
            slug: true,
            courseId: true,
            frozenAt: true,
            course: { select: { slug: true } },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException('Không tìm thấy bài viết');
    const role = await this.assertRole(user, doc.version.courseId, min);
    return { doc, role };
  }

  private async assertRole(user: AuthUser, courseId: string, min: CourseRole) {
    const role = await this.getRole(user, courseId);
    if (role === null) throw new NotFoundException('Không tìm thấy khoá học');
    if (!hasCourseRole(role, min)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này trong khoá học');
    }
    return role;
  }
}
