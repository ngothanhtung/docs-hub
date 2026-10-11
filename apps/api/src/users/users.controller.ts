import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser, SystemRoles } from '../common/decorators/auth.decorators.js';
import { AdminUpdateUserDto, ListUsersQueryDto, UpdateProfileDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @SystemRoles('ADMIN')
  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query.q);
  }

  /** Admin đổi vai trò hệ thống (ví dụ cấp quyền INSTRUCTOR) hoặc khoá tài khoản. */
  @SystemRoles('ADMIN')
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.users.adminUpdate(actor, id, dto);
  }
}
