import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/auth.decorators.js';
import { AssetsService } from './assets.service.js';
import { CreateUploadDto } from './dto/asset.dto.js';
import { DOWNLOAD_URL_TTL_SECONDS } from './storage.service.js';

@ApiTags('assets')
@ApiBearerAuth()
@Controller()
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  /** Bước 1 của upload: trả URL để PUT file thẳng lên S3. */
  @Post('courses/:courseId/assets')
  createUpload(
    @CurrentUser() user: AuthUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateUploadDto,
  ) {
    return this.assets.createUpload(user, courseId, dto);
  }

  /** Bước 2 của upload: xác nhận file đã có trên S3. */
  @HttpCode(200)
  @Post('assets/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.complete(user, id);
  }

  @Get('courses/:courseId/assets')
  list(@CurrentUser() user: AuthUser, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.assets.list(user, courseId);
  }

  /** Xem ảnh: kiểm quyền rồi chuyển hướng tới URL S3 đã ký. Đây là URL dùng trong Markdown. */
  @Get('assets/:id')
  async view(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const url = await this.assets.downloadUrl(user, id);
    // Trình duyệt dùng lại redirect trong lúc URL ký còn hạn, không gọi API mỗi lần cuộn trang.
    res.set('Cache-Control', `private, max-age=${DOWNLOAD_URL_TTL_SECONDS - 300}`);
    res.redirect(302, url);
  }

  @HttpCode(204)
  @Delete('assets/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.assets.remove(user, id);
  }
}
