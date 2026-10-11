import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/auth.decorators.js';
import {
  CourseFilterDto,
  CreateBookmarkDto,
  CreateNoteDto,
  FeedbackDto,
  ProgressHeartbeatDto,
  ProgressQueryDto,
  SetCompletedDto,
  UpdateNoteDto,
} from './dto/learning.dto.js';
import { LearningService } from './learning.service.js';

const uuid = new ParseUUIDPipe();

/** Tiến độ học, bookmark, ghi chú và đánh giá bài của chính người đang đăng nhập. */
@ApiTags('learning')
@ApiBearerAuth()
@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Put('progress/:docId')
  heartbeat(
    @CurrentUser() user: AuthUser,
    @Param('docId', uuid) docId: string,
    @Body() dto: ProgressHeartbeatDto,
  ) {
    return this.learning.heartbeat(user, docId, dto);
  }

  @HttpCode(200)
  @Post('progress/:docId/complete')
  setCompleted(
    @CurrentUser() user: AuthUser,
    @Param('docId', uuid) docId: string,
    @Body() dto: SetCompletedDto,
  ) {
    return this.learning.setCompleted(user, docId, dto.completed);
  }

  @Get('me/progress')
  courseProgress(@CurrentUser() user: AuthUser, @Query() query: ProgressQueryDto) {
    return this.learning.courseProgress(user, query.course, query.version);
  }

  @Get('me/progress/summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.learning.summary(user);
  }

  @Get('me/bookmarks')
  listBookmarks(@CurrentUser() user: AuthUser, @Query() query: CourseFilterDto) {
    return this.learning.listBookmarks(user, query.course);
  }

  @Post('me/bookmarks')
  addBookmark(@CurrentUser() user: AuthUser, @Body() dto: CreateBookmarkDto) {
    return this.learning.addBookmark(user, dto);
  }

  @HttpCode(204)
  @Delete('me/bookmarks/:id')
  removeBookmark(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.learning.removeBookmark(user, id);
  }

  @Get('me/notes')
  listNotes(@CurrentUser() user: AuthUser, @Query() query: CourseFilterDto) {
    return this.learning.listNotes(user, query);
  }

  @Post('me/notes')
  createNote(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    return this.learning.createNote(user, dto);
  }

  @Patch('me/notes/:id')
  updateNote(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.learning.updateNote(user, id, dto.content);
  }

  @HttpCode(204)
  @Delete('me/notes/:id')
  removeNote(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.learning.removeNote(user, id);
  }

  @Put('docs/:docId/feedback')
  feedback(
    @CurrentUser() user: AuthUser,
    @Param('docId', uuid) docId: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.learning.setFeedback(user, docId, dto);
  }
}
