import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { IsSlug, IsTitle } from '../../common/validation.js';

export class CreateVersionDto {
  /** Ví dụ "2027" hoặc "K2027". */
  @IsTitle(50)
  label: string;

  @IsOptional()
  @IsSlug()
  slug?: string;

  /** Sao chép toàn bộ cây bài (nháp + bản đã xuất bản) từ version này. */
  @IsOptional()
  @IsUUID()
  copyFromVersionId?: string;

  @IsOptional()
  @IsBoolean()
  makeCurrent?: boolean;
}

export class UpdateVersionDto {
  @IsOptional()
  @IsTitle(50)
  label?: string;

  /** Khoá version: không ai sửa được nội dung, dùng cho khoá học đã kết thúc. */
  @IsOptional()
  @IsBoolean()
  frozen?: boolean;
}
