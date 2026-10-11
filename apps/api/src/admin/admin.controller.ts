import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser, SystemRoles } from '../common/decorators/auth.decorators.js';
import { CoursesService } from '../courses/courses.service.js';
import { AdminService } from './admin.service.js';

export class OverviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days: 7 | 30 | 90 = 30;
}

export class AuditQueryDto {
  /** Lọc theo nhóm thao tác, ví dụ "user" hoặc "course.delete". */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  action?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 100;

  /** Phân trang: lấy các bản ghi cũ hơn id này. */
  @IsOptional()
  @Matches(/^\d+$/)
  before?: string;
}

export class TransferOwnerDto {
  @IsUUID()
  userId: string;
}

/** Trang Quản trị hệ thống. Mọi route chỉ dành cho ADMIN. */
@ApiTags('admin')
@ApiBearerAuth()
@SystemRoles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly courses: CoursesService,
    private readonly audit: AuditService,
  ) {}

  @Get('overview')
  overview(@Query() query: OverviewQueryDto) {
    return this.admin.overview(query.days);
  }

  @Get('courses')
  listCourses() {
    return this.admin.courses();
  }

  @Patch('courses/:id/owner')
  transferOwner(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransferOwnerDto,
  ) {
    return this.courses.transferOwner(user, id, dto.userId);
  }

  @Get('system')
  system() {
    return this.admin.system();
  }

  @Get('audit')
  auditLog(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
