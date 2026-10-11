import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/** Trường form multipart luôn là chuỗi: "true"/"false" -> boolean. */
const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true' || value === '1';

export class ImportDocsDto {
  /** Nguồn tài liệu; `auto` nhận diện theo docs.json/mint.json, docusaurus.config.*. */
  @IsOptional()
  @IsIn(['auto', 'docusaurus', 'mintlify'])
  format: 'auto' | 'docusaurus' | 'mintlify' = 'auto';

  /** Chỉ phân tích và trả báo cáo, không ghi gì. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  dryRun = false;

  /** Xuất bản ngay các bài vừa nhập (chỉ chủ khoá). Mặc định là bản nháp. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  publish = false;

  /** Đặt toàn bộ nội dung nhập vào một nhóm mới có tên này (bỏ trống = gốc phiên bản). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoryLabel?: string;
}
