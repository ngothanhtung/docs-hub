import { Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser, SystemRoles } from '../common/decorators/auth.decorators.js';
import { SearchIndexService } from './search-index.service.js';

@ApiTags('search')
@ApiBearerAuth()
@Controller('admin/search')
export class SearchController {
  constructor(
    private readonly search: SearchIndexService,
    private readonly audit: AuditService,
  ) {}

  /** Lập lại toàn bộ chỉ mục tìm kiếm (sau khi khôi phục database, đổi cấu hình index...). */
  @SystemRoles('ADMIN')
  @HttpCode(200)
  @Post('reindex')
  async reindex(@CurrentUser() user: AuthUser) {
    const result = await this.search.reindexAll();
    await this.audit.record({
      actorId: user.id,
      action: 'search.reindex',
      targetType: 'search',
      summary: `Lập lại chỉ mục tìm kiếm (${result.versions} phiên bản)`,
    });
    return result;
  }
}
