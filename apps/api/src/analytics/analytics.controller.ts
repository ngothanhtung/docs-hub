import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/auth.decorators.js';
import { AnalyticsService } from './analytics.service.js';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days: 7 | 30 | 90 = 30;
}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Số liệu dashboard của khoá học. Chỉ chủ khoá. */
  @Get('courses/:courseId')
  course(
    @CurrentUser() user: AuthUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analytics.course(user, courseId, { versionSlug: query.version, days: query.days });
  }
}
