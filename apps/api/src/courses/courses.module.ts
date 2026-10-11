import { Module } from '@nestjs/common';
import { CourseAccessService } from './course-access.service.js';
import { CoursesController } from './courses.controller.js';
import { CoursesService } from './courses.service.js';
import { MembersService } from './members.service.js';

@Module({
  controllers: [CoursesController],
  providers: [CoursesService, MembersService, CourseAccessService],
  exports: [CoursesService, CourseAccessService],
})
export class CoursesModule {}
