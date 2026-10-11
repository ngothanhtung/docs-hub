import { THEME_IDS, type ThemeId } from '../../common/themes.js';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { SystemRole } from '../../generated/prisma/enums.js';

export class UserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  @IsEnum(SystemRole)
  systemRole: SystemRole;
  createdAt: Date;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  avatarUrl?: string;

  /** Theme tự chọn, đè theme của khoá học; null = theo khoá học. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(THEME_IDS, { message: 'Theme không hợp lệ' })
  theme?: ThemeId | null;
}

export class AdminUpdateUserDto {
  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListUsersQueryDto {
  /** Tìm theo email hoặc tên. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
