import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { SystemRole } from '../../generated/prisma/enums.js';
import type { AccessTokenPayload, AuthUser } from '../auth-user.js';
import { IS_PUBLIC_KEY, SYSTEM_ROLES_KEY } from '../decorators/auth.decorators.js';

/**
 * Guard toàn cục: mọi route yêu cầu access token (Bearer), trừ route gắn @Public().
 * Đồng thời kiểm tra @SystemRoles() nếu có.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Thiếu access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Access token không hợp lệ hoặc đã hết hạn');
    }
    request.user = { id: payload.sub, email: payload.email, systemRole: payload.role };

    const roles = this.reflector.getAllAndOverride<SystemRole[] | undefined>(
      SYSTEM_ROLES_KEY,
      targets,
    );
    if (roles && !roles.includes(payload.role)) {
      throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
    }
    return true;
  }
}
