import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsSlug, IsTitle } from '../../common/validation.js';

/** Giới hạn độ dài một bài Markdown (~500 KB). */
export const MAX_SOURCE_LENGTH = 500_000;

export class CreateCategoryDto {
  @IsTitle(100)
  label: string;

  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  /** Tên icon lucide dạng kebab-case, ví dụ "layers", "book-open". */
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Tên icon không hợp lệ' })
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  collapsed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsTitle(100)
  label?: string;

  @IsOptional()
  @IsSlug()
  slug?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Tên icon không hợp lệ' })
  @MaxLength(50)
  icon?: string | null;

  @IsOptional()
  @IsBoolean()
  collapsed?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;
}

export class CategoryPlacementDto {
  @IsUUID()
  id: string;

  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId: string | null;

  @IsInt()
  @Min(0)
  @Max(100_000)
  position: number;
}

export class DocPlacementDto {
  @IsUUID()
  id: string;

  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  categoryId: string | null;

  @IsInt()
  @Min(0)
  @Max(100_000)
  position: number;
}

/** Kết quả kéo-thả trên sidebar: vị trí mới của các category/bài bị ảnh hưởng. */
export class ReorderTreeDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => CategoryPlacementDto)
  categories?: CategoryPlacementDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => DocPlacementDto)
  docs?: DocPlacementDto[];
}

export class CreateDocDto {
  @IsTitle()
  title: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsSlug()
  slug?: string;

  /** Nội dung ban đầu; bỏ trống thì tạo frontmatter chỉ có title. */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SOURCE_LENGTH)
  source?: string;
}

export class UpdateDocDto {
  @IsOptional()
  @IsSlug()
  slug?: string;
}

export class SaveDraftDto {
  @IsString()
  @MaxLength(MAX_SOURCE_LENGTH)
  source: string;

  /**
   * `sourceUpdatedAt` mà editor đang giữ. Nếu người khác đã lưu sau thời điểm này,
   * API trả 409 để không ghi đè thay đổi của họ.
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  baseUpdatedAt?: Date;

  /** true khi người dùng chủ động lưu (Ctrl+S): tạo revision. Autosave để false. */
  @IsOptional()
  @IsBoolean()
  createRevision?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}

export class PublishDocDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;

  /** Hẹn giờ mở bài cho học viên. Bỏ trống = mở ngay. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  publishAt?: Date;
}

export class LockDocDto {
  /** Giành khoá kể cả khi người khác đang giữ. */
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}

export class RenderPreviewDto {
  @IsUUID()
  versionId: string;

  @IsString()
  @MaxLength(MAX_SOURCE_LENGTH)
  source: string;
}

export class ReadQueryDto {
  /** Slug version; bỏ trống thì dùng version của lớp hoặc version hiện hành. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

export class ReadPageQueryDto extends ReadQueryDto {
  /** Đường dẫn trong khoá, ví dụ "kien-truc/provider". */
  @IsString()
  @MaxLength(500)
  @Matches(/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/, { message: 'Đường dẫn không hợp lệ' })
  path: string;
}

export class SearchQueryDto extends ReadQueryDto {
  @IsString()
  @MaxLength(100)
  q: string;
}
