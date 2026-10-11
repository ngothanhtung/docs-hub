import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';
import { StorageService } from './storage.service.js';

@Module({
  imports: [CoursesModule],
  controllers: [AssetsController],
  providers: [AssetsService, StorageService],
  exports: [AssetsService, StorageService],
})
export class AssetsModule {}
