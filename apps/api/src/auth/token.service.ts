import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '../common/auth-user.js';
import type { Env } from '../config/env.js';
import type { SystemRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ClientMeta {
  userAgent?: string;
  ip?: string;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/** Hai tab cùng refresh một lúc: token vừa xoay trong khoảng này không bị coi là bị lộ. */
const REUSE_GRACE_MS = 10_000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get accessTtlSeconds(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true });
  }

  signAccessToken(user: { id: string; email: string; systemRole: SystemRole }) {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.systemRole,
    };
    return this.jwt.signAsync(payload, { expiresIn: this.accessTtlSeconds });
  }

  /** Mở family mới (đăng nhập) hoặc nối tiếp family cũ (xoay vòng). */
  async issueRefreshToken(
    userId: string,
    meta: ClientMeta,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(48).toString('base64url');
    const ttlDays = this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true });
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip,
      },
    });
    return { token, expiresAt };
  }

  /**
   * Đổi refresh token cũ lấy token mới trong cùng family.
   * Token đã thu hồi mà bị dùng lại (quá thời gian ân hạn) thì thu hồi cả family.
   */
  async rotateRefreshToken(token: string, meta: ClientMeta) {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (!current) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');

    if (current.revokedAt) {
      if (Date.now() - current.revokedAt.getTime() > REUSE_GRACE_MS) {
        await this.revokeFamily(current.familyId);
      }
      throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực');
    }
    if (current.expiresAt <= new Date() || !current.user.isActive) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }

    // updateMany có điều kiện revokedAt = null để hai request song song không cùng xoay được.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new UnauthorizedException('Phiên đăng nhập đã hết hiệu lực');

    const next = await this.issueRefreshToken(current.userId, meta, current.familyId);
    return { user: current.user, refreshToken: next };
  }

  /** Đăng xuất: thu hồi cả family của token (mọi token xoay ra từ lần đăng nhập đó). */
  async revokeByToken(token: string) {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { familyId: true },
    });
    if (current) await this.revokeFamily(current.familyId);
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
