import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../common/auth-user.js';
import { CourseRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { publicUserSelect } from '../users/user.select.js';
import { CourseAccessService } from './course-access.service.js';
import type {
  AddMemberDto,
  CreateCohortDto,
  EnrollLearnersDto,
  UpdateCohortDto,
  UpdateMemberDto,
} from './dto/course.dto.js';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  async list(user: AuthUser, courseId: string) {
    await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    return this.prisma.courseMember.findMany({
      where: { courseId },
      select: {
        role: true,
        createdAt: true,
        cohort: { select: { id: true, name: true } },
        user: { select: publicUserSelect },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Thêm một thành viên. Người được thêm phải đã có tài khoản
   * (mời qua email sẽ có khi tích hợp dịch vụ gửi mail).
   */
  async add(user: AuthUser, courseId: string, dto: AddMemberDto) {
    await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    if (dto.cohortId) await this.assertCohortInCourse(courseId, dto.cohortId);
    const target = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException('Người dùng chưa có tài khoản DocsHub với email này');
    }
    const existing = await this.prisma.courseMember.findUnique({
      where: { courseId_userId: { courseId, userId: target.id } },
    });
    if (existing) throw new ConflictException('Người dùng đã là thành viên của khoá học');

    return this.prisma.courseMember.create({
      data: { courseId, userId: target.id, role: dto.role, cohortId: dto.cohortId },
      select: {
        role: true,
        cohort: { select: { id: true, name: true } },
        user: { select: publicUserSelect },
      },
    });
  }

  /** Ghi danh hàng loạt học viên; báo lại email chưa có tài khoản và email đã là thành viên. */
  async enrollLearners(user: AuthUser, courseId: string, dto: EnrollLearnersDto) {
    await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    if (dto.cohortId) await this.assertCohortInCourse(courseId, dto.cohortId);

    const emails = [...new Set(dto.emails.map((e) => e.trim().toLowerCase()))];
    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true, memberships: { where: { courseId }, select: { role: true } } },
    });
    const found = new Set(users.map((u) => u.email));
    const toEnroll = users.filter((u) => u.memberships.length === 0);

    await this.prisma.courseMember.createMany({
      data: toEnroll.map((u) => ({
        courseId,
        userId: u.id,
        role: CourseRole.LEARNER,
        cohortId: dto.cohortId,
      })),
      skipDuplicates: true,
    });
    return {
      enrolled: toEnroll.map((u) => u.email),
      alreadyMembers: users.filter((u) => u.memberships.length > 0).map((u) => u.email),
      notFound: emails.filter((e) => !found.has(e)),
    };
  }

  async update(user: AuthUser, courseId: string, userId: string, dto: UpdateMemberDto) {
    const { course } = await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    if (dto.role && dto.role !== CourseRole.OWNER && userId === course.ownerId) {
      throw new BadRequestException('Không thể hạ quyền chủ khoá học');
    }
    if (dto.cohortId) await this.assertCohortInCourse(courseId, dto.cohortId);
    return this.prisma.courseMember.update({
      where: { courseId_userId: { courseId, userId } },
      data: dto,
      select: {
        role: true,
        cohort: { select: { id: true, name: true } },
        user: { select: publicUserSelect },
      },
    });
  }

  async remove(user: AuthUser, courseId: string, userId: string) {
    const { course } = await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    if (userId === course.ownerId) {
      throw new BadRequestException('Không thể xoá chủ khoá học khỏi khoá');
    }
    await this.prisma.courseMember.delete({
      where: { courseId_userId: { courseId, userId } },
    });
  }

  async listCohorts(user: AuthUser, courseId: string) {
    await this.access.requireCourse(user, courseId, CourseRole.EDITOR);
    return this.prisma.cohort.findMany({
      where: { courseId },
      include: {
        version: { select: { id: true, slug: true, label: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCohort(user: AuthUser, courseId: string, dto: CreateCohortDto) {
    await this.access.requireCourse(user, courseId, CourseRole.OWNER);
    if (dto.versionId) await this.assertVersionInCourse(courseId, dto.versionId);
    assertDateRange(dto.startAt, dto.endAt);
    return this.prisma.cohort.create({
      data: {
        courseId,
        name: dto.name,
        versionId: dto.versionId,
        startAt: dto.startAt,
        endAt: dto.endAt,
      },
    });
  }

  async updateCohort(user: AuthUser, cohortId: string, dto: UpdateCohortDto) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new NotFoundException('Không tìm thấy lớp học');
    await this.access.requireCourse(user, cohort.courseId, CourseRole.OWNER);
    if (dto.versionId) await this.assertVersionInCourse(cohort.courseId, dto.versionId);
    assertDateRange(
      dto.startAt === undefined ? cohort.startAt : dto.startAt,
      dto.endAt === undefined ? cohort.endAt : dto.endAt,
    );
    return this.prisma.cohort.update({ where: { id: cohortId }, data: dto });
  }

  async removeCohort(user: AuthUser, cohortId: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new NotFoundException('Không tìm thấy lớp học');
    await this.access.requireCourse(user, cohort.courseId, CourseRole.OWNER);
    await this.prisma.cohort.delete({ where: { id: cohortId } });
  }

  private async assertCohortInCourse(courseId: string, cohortId: string) {
    const count = await this.prisma.cohort.count({ where: { id: cohortId, courseId } });
    if (count === 0) throw new BadRequestException('Lớp học không thuộc khoá học này');
  }

  private async assertVersionInCourse(courseId: string, versionId: string) {
    const count = await this.prisma.version.count({ where: { id: versionId, courseId } });
    if (count === 0) throw new BadRequestException('Phiên bản không thuộc khoá học này');
  }
}

function assertDateRange(startAt?: Date | null, endAt?: Date | null) {
  if (startAt && endAt && startAt > endAt) {
    throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
  }
}
