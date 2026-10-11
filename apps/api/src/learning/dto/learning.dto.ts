import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProgressHeartbeatDto {
  /** Phần trăm bài đã cuộn tới (lấy giá trị lớn nhất từng đạt). */
  @IsInt()
  @Min(0)
  @Max(100)
  scrollPct: number;

  /** Số giây đọc thêm kể từ lần gửi trước (chỉ tính khi tab đang hiển thị). */
  @IsInt()
  @Min(0)
  @Max(300)
  secondsDelta: number;
}

export class SetCompletedDto {
  @IsBoolean()
  completed: boolean;
}

export class ProgressQueryDto {
  @IsString()
  @MaxLength(100)
  course: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

export class CourseFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  course?: string;

  @IsOptional()
  @IsUUID()
  docId?: string;
}

/** Anchor = id heading; chuỗi rỗng = cả bài. */
const ANCHOR_PATTERN = /^[^\s"'<>]*$/u;

export class CreateBookmarkDto {
  @IsUUID()
  docId: string;

  @IsString()
  @MaxLength(200)
  @Matches(ANCHOR_PATTERN)
  anchor: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}

export class CreateNoteDto {
  @IsUUID()
  docId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(ANCHOR_PATTERN)
  anchor?: string;

  /** Đoạn văn được bôi đen khi tạo ghi chú. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  quote?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}

export class UpdateNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}

export class FeedbackDto {
  @IsBoolean()
  helpful: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
