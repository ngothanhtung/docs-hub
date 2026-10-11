import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AuditAction =
  | 'settings.update'
  | 'user.role'
  | 'user.activate'
  | 'user.deactivate'
  | 'course.archive'
  | 'course.unarchive'
  | 'course.delete'
  | 'course.transfer'
  | 'search.reindex';

export interface AuditEntry {
  actorId: string | null;
  action: AuditAction;
  summary: string;
  targetType?: 'user' | 'course' | 'settings' | 'search';
  targetId?: string;
  meta?: Prisma.InputJsonValue;
}

/** Nhật ký thao tác quản trị. Ghi lỗi thì chỉ log, không làm hỏng thao tác chính. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (error) {
      this.logger.error(`Không ghi được nhật ký ${entry.action}: ${(error as Error).message}`);
    }
  }

  async list(filter: { action?: string; limit: number; before?: string }) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(filter.action ? { action: { startsWith: filter.action } } : {}),
        ...(filter.before ? { id: { lt: BigInt(filter.before) } } : {}),
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { id: 'desc' },
      take: filter.limit,
    });
    return rows.map((row) => ({ ...row, id: row.id.toString() }));
  }
}
