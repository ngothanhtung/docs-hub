import type { Prisma } from '../generated/prisma/client.js';

/** Trường của user được phép trả ra API (không bao giờ có passwordHash). */
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  theme: true,
  systemRole: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;
