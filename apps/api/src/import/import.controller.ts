import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/auth.decorators.js';
import { ImportDocsDto } from './dto/import.dto.js';
import { IMPORT_LIMITS, ImportService, type UploadedFile } from './import.service.js';

@ApiTags('import')
@ApiBearerAuth()
@Controller('versions')
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  /**
   * Nhập tài liệu Docusaurus/Mintlify vào một phiên bản. Gửi multipart, field `files`:
   * một file .zip, cả thư mục (giữ đường dẫn tương đối) hoặc nhiều file .md/.mdx + ảnh.
   * `dryRun=true` chỉ trả báo cáo để xem trước.
   */
  @Post(':versionId/import')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FilesInterceptor('files', IMPORT_LIMITS.files, {
      limits: { fileSize: IMPORT_LIMITS.uploadBytes, files: IMPORT_LIMITS.files },
      // Giữ đường dẫn thư mục khi tải cả thư mục lên; tên file tiếng Việt là UTF-8.
      preservePath: true,
      defParamCharset: 'utf8',
    }),
  )
  import(
    @CurrentUser() user: AuthUser,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @UploadedFiles() files: UploadedFile[],
    @Body() dto: ImportDocsDto,
  ) {
    return this.importer.import(user, versionId, files, dto);
  }
}
