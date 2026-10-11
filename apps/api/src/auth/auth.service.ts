import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type { User } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { publicUserSelect, type PublicUser } from '../users/user.select.js';
import type { LoginDto, RegisterDto } from './dto/auth.dto.js';
import { GoogleAuthService } from './google-auth.service.js';
import { type ClientMeta, type IssuedRefreshToken, TokenService } from './token.service.js';

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  user: PublicUser;
  refreshToken: IssuedRefreshToken;
}

/** Thông báo chung cho sai email hoặc sai mật khẩu, để không lộ email nào đã đăng ký. */
const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly google: GoogleAuthService,
    private readonly settings: SettingsService,
  ) {}

  async register(dto: RegisterDto, meta: ClientMeta): Promise<AuthSession> {
    const role = await this.assertSignupAllowed(dto.email);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email đã được đăng ký');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: await argon2.hash(dto.password),
        systemRole: role,
      },
    });
    return this.startSession(user, meta);
  }

  async login(dto: LoginDto, meta: ClientMeta): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash) {
      // Vẫn băm để thời gian phản hồi không tiết lộ email có tồn tại hay không.
      await argon2.hash(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return this.startSession(user, meta);
  }

  async loginWithGoogle(idToken: string, meta: ClientMeta): Promise<AuthSession> {
    if (!(await this.settings.get()).auth.googleLogin) {
      throw new ForbiddenException('Đăng nhập bằng Google đang tắt');
    }
    const profile = await this.google.verify(idToken);
    let user =
      (await this.prisma.user.findUnique({ where: { googleId: profile.googleId } })) ??
      (await this.prisma.user.findUnique({ where: { email: profile.email } }));

    if (user && !user.googleId) {
      // Email đã có tài khoản mật khẩu: liên kết Google vào tài khoản đó.
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.googleId, avatarUrl: user.avatarUrl ?? profile.avatarUrl },
      });
    }
    if (!user) {
      const role = await this.assertSignupAllowed(profile.email);
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          googleId: profile.googleId,
          avatarUrl: profile.avatarUrl,
          systemRole: role,
        },
      });
    }
    return this.startSession(user, meta);
  }

  async refresh(refreshToken: string, meta: ClientMeta): Promise<AuthSession> {
    const { user, refreshToken: next } = await this.tokens.rotateRefreshToken(refreshToken, meta);
    return {
      accessToken: await this.tokens.signAccessToken(user),
      expiresIn: this.tokens.accessTtlSeconds,
      user: pickPublic(user),
      refreshToken: next,
    };
  }

  logout(refreshToken: string) {
    return this.tokens.revokeByToken(refreshToken);
  }

  private async startSession(user: User, meta: ClientMeta): Promise<AuthSession> {
    if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị khoá');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return {
      accessToken: await this.tokens.signAccessToken(user),
      expiresIn: this.tokens.accessTtlSeconds,
      user: pickPublic(user),
      refreshToken: await this.tokens.issueRefreshToken(user.id, meta),
    };
  }

  /** Kiểm tra cấu hình đăng ký (admin chỉnh trong Quản trị → Cài đặt); trả về vai trò mặc định cho tài khoản mới. */
  private async assertSignupAllowed(email: string) {
    const { auth } = await this.settings.get();
    if (!auth.allowSignup) {
      throw new ForbiddenException('Hệ thống không cho phép tự đăng ký tài khoản');
    }
    const domain = email.split('@').pop()?.toLowerCase() ?? '';
    if (auth.allowedEmailDomains.length > 0 && !auth.allowedEmailDomains.includes(domain)) {
      throw new ForbiddenException(
        `Chỉ email thuộc ${auth.allowedEmailDomains.map((d) => `@${d}`).join(', ')} được tự đăng ký`,
      );
    }
    return auth.defaultSystemRole;
  }
}

function pickPublic(user: User): PublicUser {
  return Object.fromEntries(
    Object.keys(publicUserSelect).map((key) => [key, user[key as keyof User]]),
  ) as PublicUser;
}
