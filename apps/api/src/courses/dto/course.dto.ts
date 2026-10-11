import { HEX_COLOR_RE, THEME_IDS, type ThemeId } from '../../common/themes.js';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsSlug, IsTitle } from '../../common/validation.js';
import { CourseRole } from '../../generated/prisma/enums.js';

export class CreateCourseDto {
  @IsTitle()
  title: string;

  /** Bỏ trống thì tự sinh từ tiêu đề. */
  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;

  /** Nhãn version đầu tiên, mặc định là năm hiện tại, ví dụ "2026". */
  @IsOptional()
  @IsTitle(50)
  versionLabel?: string;
}

export class UpdateCourseDto {
  @IsOptional()
  @IsTitle()
  title?: string;

  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl()
  coverUrl?: string | null;

  /** Theme của khoá; null = theme mặc định. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(THEME_IDS, { message: 'Theme không hợp lệ' })
  theme?: ThemeId | null;

  /** Màu chính #rrggbb đè màu của theme; null = dùng màu của theme. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(HEX_COLOR_RE, { message: 'Màu chính phải có dạng #rrggbb' })
  primaryColor?: string | null;
}

export class AddMemberDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsEnum(CourseRole)
  role: CourseRole;

  @IsOptional()
  @IsUUID()
  cohortId?: string;
}

/** Ghi danh nhiều học viên một lần bằng danh sách email. */
export class EnrollLearnersDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsEmail({}, { each: true, message: 'Có email không hợp lệ trong danh sách' })
  emails: string[];

  @IsOptional()
  @IsUUID()
  cohortId?: string;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(CourseRole)
  role?: CourseRole;

  /** null để bỏ học viên khỏi lớp. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  cohortId?: string | null;
}

export class CreateCohortDto {
  @IsTitle(100)
  name: string;

  @IsOptional()
  @IsUUID()
  versionId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endAt?: Date;
}

export class UpdateCohortDto {
  @IsOptional()
  @IsTitle(100)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  versionId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Date)
  @IsDate()
  startAt?: Date | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Date)
  @IsDate()
  endAt?: Date | null;
}
