import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { CoursesModule } from '../courses/courses.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [CoursesModule, ContentModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
