import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import type { SystemRole } from '../../generated/prisma/enums.js';
import type { AuthUser } from '../auth-user.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const SYSTEM_ROLES_KEY = 'systemRoles';

/** Bỏ qua JwtAuthGuard cho route không cần đăng nhập. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Giới hạn route theo vai trò hệ thống, ví dụ chỉ ADMIN. */
export const SystemRoles = (...roles: SystemRole[]) =>
  SetMetadata(SYSTEM_ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user,
);
