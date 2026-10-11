import { Module } from '@nestjs/common';
import { SearchController } from './search.controller.js';
import { SearchIndexService } from './search-index.service.js';

@Module({
  controllers: [SearchController],
  providers: [SearchIndexService],
  exports: [SearchIndexService],
})
export class SearchModule {}
