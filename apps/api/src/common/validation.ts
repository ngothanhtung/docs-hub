import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/** Slug ASCII: chữ thường, số, gạch ngang. Dùng chung cho khoá học, version, nhóm bài, bài. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function IsSlug() {
  return applyDecorators(
    IsString(),
    MaxLength(100),
    Matches(SLUG_PATTERN, {
      message: 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang',
    }),
  );
}

export function IsTitle(max = 200) {
  return applyDecorators(
    Transform(({ value }) => (typeof value === 'string' ? value.trim() : value)),
    IsString(),
    IsNotEmpty({ message: 'Không được để trống' }),
    MaxLength(max),
  );
}
