import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/auth.decorators.js';
import { CreateVersionDto, UpdateVersionDto } from './dto/version.dto.js';
import { VersionsService } from './versions.service.js';

@ApiTags('versions')
@ApiBearerAuth()
@Controller()
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Get('courses/:courseId/versions')
  list(@CurrentUser() user: AuthUser, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.versions.list(user, courseId);
  }

  @Post('courses/:courseId/versions')
  create(
    @CurrentUser() user: AuthUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.versions.create(user, courseId, dto);
  }

  @Patch('versions/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVersionDto,
  ) {
    return this.versions.update(user, id, dto);
  }

  @HttpCode(200)
  @Post('versions/:id/make-current')
  makeCurrent(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.versions.makeCurrent(user, id);
  }

  @HttpCode(204)
  @Delete('versions/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.versions.remove(user, id);
  }
}
