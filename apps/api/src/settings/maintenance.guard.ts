import { type CanActivate, type ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../common/auth-user.js';
import { SettingsService } from './settings.service.js';

/** Route vẫn chạy khi bảo trì: đăng nhập (để admin vào được), cấu hình công khai, kiểm tra sức khoẻ. */
const ALWAYS_OPEN = [/^\/api\/v1\/auth\//, /^\/api\/v1\/settings\/public$/, /^\/api\/v1\/health$/];

/**
 * Chế độ bảo trì: chặn mọi request của người không phải admin bằng 503 kèm thông điệp.
 * Chạy sau JwtAuthGuard nên đã biết vai trò người gọi.
 */
@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly settings: SettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (ALWAYS_OPEN.some((re) => re.test(request.path))) return true;
    const { maintenance } = await this.settings.get();
    if (!maintenance.enabled || request.user?.systemRole === 'ADMIN') return true;
    throw new ServiceUnavailableException({ code: 'MAINTENANCE', message: maintenance.message || 'Hệ thống đang bảo trì' });
  }
}
