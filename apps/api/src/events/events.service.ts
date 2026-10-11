import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type EventType = 'doc_view' | 'search';

/**
 * Ghi sự kiện học tập làm nguồn cho dashboard thống kê. Ghi không chặn request:
 * lỗi ghi sự kiện chỉ log, không làm hỏng trải nghiệm đọc.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  record(event: {
    type: EventType;
    userId: string;
    courseId: string;
    docId?: string;
    payload?: Prisma.InputJsonValue;
  }) {
    this.prisma.event
      .create({ data: event })
      .catch((error: Error) => this.logger.warn(`Không ghi được sự kiện ${event.type}: ${error.message}`));
  }
}
