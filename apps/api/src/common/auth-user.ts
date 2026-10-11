import type { SystemRole } from '../generated/prisma/enums.js';

/** Người dùng đã xác thực, lấy từ access token và gắn vào `request.user`. */
export interface AuthUser {
  id: string;
  email: string;
  systemRole: SystemRole;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: SystemRole;
}
