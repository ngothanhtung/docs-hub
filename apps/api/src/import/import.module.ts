import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module.js';
import { ContentModule } from '../content/content.module.js';
import { CoursesModule } from '../courses/courses.module.js';
import { ImportController } from './import.controller.js';
import { ImportService } from './import.service.js';

@Module({
  imports: [CoursesModule, ContentModule, AssetsModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
