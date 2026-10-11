import { IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

/** Định dạng ảnh được nhận. Không nhận SVG vì có thể chứa script. */
export const IMAGE_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const;

export const MAX_ASSET_BYTES = 10 * 1024 * 1024;

export class CreateUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @IsIn(Object.keys(IMAGE_TYPES), { message: 'Chỉ nhận ảnh PNG, JPEG, GIF, WebP hoặc AVIF' })
  contentType: keyof typeof IMAGE_TYPES;

  @IsInt()
  @Min(1)
  @Max(MAX_ASSET_BYTES, { message: 'Ảnh tối đa 10 MB' })
  size: number;
}
