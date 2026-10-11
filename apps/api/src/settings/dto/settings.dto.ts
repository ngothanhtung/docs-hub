import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { HEX_COLOR_RE, THEME_IDS, type ThemeId } from '../../common/themes.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class GeneralSettingsDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(60)
  siteName?: string;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(160)
  tagline?: string;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsEmail({}, { message: 'Email hỗ trợ không hợp lệ' })
  supportEmail?: string | null;
}

export class AuthSettingsDto {
  @IsOptional() @IsBoolean()
  allowSignup?: boolean;

  @IsOptional() @IsBoolean()
  googleLogin?: boolean;

  /** Tên miền email (không có @), ví dụ "softech.vn". */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Transform(({ value }) =>
    Array.isArray(value)
      ? [...new Set(value.map((d) => String(d).trim().toLowerCase().replace(/^@/, '')).filter(Boolean))]
      : value,
  )
  @Matches(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, { each: true, message: 'Tên miền email không hợp lệ' })
  allowedEmailDomains?: string[];

  @IsOptional() @IsIn(['USER', 'INSTRUCTOR'])
  defaultSystemRole?: 'USER' | 'INSTRUCTOR';
}

export class AppearanceSettingsDto {
  @IsOptional() @IsIn(THEME_IDS, { message: 'Theme không hợp lệ' })
  defaultTheme?: ThemeId;

  @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(HEX_COLOR_RE, { message: 'Màu phải có dạng #rrggbb' })
  defaultPrimaryColor?: string | null;
}

export class ContentSettingsDto {
  @IsOptional() @IsInt() @Min(1) @Max(10)
  maxImageMb?: number;

  @IsOptional() @IsBoolean()
  importEnabled?: boolean;

  @IsOptional() @IsInt() @Min(1) @Max(1000)
  importMaxDocs?: number;
}

export class LearningSettingsDto {
  @IsOptional() @IsInt() @Min(50) @Max(100)
  autoCompleteScrollPct?: number;

  @IsOptional() @IsInt() @Min(0) @Max(600)
  autoCompleteSeconds?: number;
}

export class AnnouncementSettingsDto {
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  message?: string;

  @IsOptional() @IsIn(['info', 'warning', 'danger'])
  tone?: 'info' | 'warning' | 'danger';
}

export class MaintenanceSettingsDto {
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(300)
  message?: string;
}

/** Sửa một hoặc nhiều nhóm; trường không gửi giữ nguyên. */
export class UpdateSettingsDto {
  @IsOptional() @ValidateNested() @Type(() => GeneralSettingsDto)
  general?: GeneralSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => AuthSettingsDto)
  auth?: AuthSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => AppearanceSettingsDto)
  appearance?: AppearanceSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => ContentSettingsDto)
  content?: ContentSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => LearningSettingsDto)
  learning?: LearningSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => AnnouncementSettingsDto)
  announcement?: AnnouncementSettingsDto;

  @IsOptional() @ValidateNested() @Type(() => MaintenanceSettingsDto)
  maintenance?: MaintenanceSettingsDto;
}
