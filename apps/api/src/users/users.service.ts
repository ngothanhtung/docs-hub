import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminUpdateUserDto, UpdateProfileDto } from './dto/user.dto.js';
import { publicUserSelect, type PublicUser } from './user.select.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getById(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: publicUserSelect,
    });
  }

  updateProfile(id: string, dto: UpdateProfileDto): Promise<PublicUser> {
    return this.prisma.user.update({ where: { id }, data: dto, select: publicUserSelect });
  }

  /** Danh sách cho trang quản trị: kèm số khoá tham gia và số khoá sở hữu. */
  async list(q?: string) {
    const users = await this.prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        ...publicUserSelect,
        isActive: true,
        lastLoginAt: true,
        googleId: true,
        _count: { select: { memberships: true, ownedCourses: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
    return users.map(({ _count, googleId, ...user }) => ({
      ...user,
      hasGoogle: googleId !== null,
      courses: _count.memberships,
      ownedCourses: _count.ownedCourses,
    }));
  }

  /**
   * Admin đổi vai trò hoặc khoá/mở tài khoản. Không cho tự hạ quyền/khoá chính mình
   * và không để hệ thống mất admin đang hoạt động cuối cùng.
   */
  async adminUpdate(actor: AuthUser, id: string, dto: AdminUpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('Không tìm thấy người dùng');
    const demotes = dto.systemRole !== undefined && dto.systemRole !== 'ADMIN' && target.systemRole === 'ADMIN';
    const deactivates = dto.isActive === false && target.isActive;
    if (id === actor.id && (demotes || deactivates)) {
      throw new BadRequestException('Không thể tự hạ quyền hoặc khoá tài khoản của chính mình');
    }
    if ((demotes || deactivates) && target.systemRole === 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { systemRole: 'ADMIN', isActive: true } });
      if (admins <= 1) throw new BadRequestException('Hệ thống cần ít nhất một quản trị viên đang hoạt động');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: dto,
      select: { ...publicUserSelect, isActive: true, lastLoginAt: true },
    });
    if (deactivates) {
      // Khoá tài khoản thì đăng xuất mọi phiên ngay.
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (dto.systemRole !== undefined && dto.systemRole !== target.systemRole) {
      await this.audit.record({
        actorId: actor.id,
        action: 'user.role',
        targetType: 'user',
        targetId: id,
        summary: `Đổi vai trò ${target.email}: ${target.systemRole} → ${dto.systemRole}`,
        meta: { from: target.systemRole, to: dto.systemRole },
      });
    }
    if (dto.isActive !== undefined && dto.isActive !== target.isActive) {
      await this.audit.record({
        actorId: actor.id,
        action: dto.isActive ? 'user.activate' : 'user.deactivate',
        targetType: 'user',
        targetId: id,
        summary: `${dto.isActive ? 'Mở khoá' : 'Khoá'} tài khoản ${target.email}`,
      });
    }
    return user;
  }
}
