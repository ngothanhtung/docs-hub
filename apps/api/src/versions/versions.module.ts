import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module.js';
import { SearchModule } from '../search/search.module.js';
import { VersionsController } from './versions.controller.js';
import { VersionsService } from './versions.service.js';

@Module({
  imports: [CoursesModule, SearchModule],
  controllers: [VersionsController],
  providers: [VersionsService],
})
export class VersionsModule {}
