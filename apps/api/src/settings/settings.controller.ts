import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser, Public, SystemRoles } from '../common/decorators/auth.decorators.js';
import { UpdateSettingsDto } from './dto/settings.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('settings')
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Cấu hình công khai: tên site, đăng ký, thông báo, bảo trì. Không cần đăng nhập. */
  @Public()
  @Get('settings/public')
  publicSettings() {
    return this.settings.publicSettings();
  }

  @ApiBearerAuth()
  @SystemRoles('ADMIN')
  @Get('admin/settings')
  get() {
    return this.settings.forAdmin();
  }

  @ApiBearerAuth()
  @SystemRoles('ADMIN')
  @Patch('admin/settings')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.settings.update(user, dto);
  }
}
