import { Module } from '@nestjs/common';
import { CoursesModule } from '../courses/courses.module.js';
import { SearchModule } from '../search/search.module.js';
import { CategoriesService } from './categories.service.js';
import { ReaderController, StudioController } from './content.controller.js';
import { DocsService } from './docs.service.js';
import { ReaderService } from './reader.service.js';
import { RenderService } from './render.service.js';
import { TreeService } from './tree.service.js';

@Module({
  imports: [CoursesModule, SearchModule],
  controllers: [StudioController, ReaderController],
  providers: [TreeService, CategoriesService, DocsService, ReaderService, RenderService],
  exports: [TreeService, DocsService, CategoriesService],
})
export class ContentModule {}
