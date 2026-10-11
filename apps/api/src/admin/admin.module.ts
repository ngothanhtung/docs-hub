import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module.js';
import { CoursesModule } from '../courses/courses.module.js';
import { SearchModule } from '../search/search.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [CoursesModule, SearchModule, AssetsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
