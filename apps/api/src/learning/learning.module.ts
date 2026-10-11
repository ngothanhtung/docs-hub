import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module.js';
import { CoursesModule } from '../courses/courses.module.js';
import { LearningController } from './learning.controller.js';
import { LearningService } from './learning.service.js';

@Module({
  imports: [CoursesModule, ContentModule],
  controllers: [LearningController],
  providers: [LearningService],
})
export class LearningModule {}
