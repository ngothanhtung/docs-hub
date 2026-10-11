import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser } from '../common/decorators/auth.decorators.js';
import { CourseAccessService } from '../courses/course-access.service.js';
import { CourseRole } from '../generated/prisma/enums.js';
import { CategoriesService } from './categories.service.js';
import { DocsService } from './docs.service.js';
import {
  CreateCategoryDto,
  CreateDocDto,
  LockDocDto,
  PublishDocDto,
  ReadPageQueryDto,
  ReadQueryDto,
  RenderPreviewDto,
  ReorderTreeDto,
  SaveDraftDto,
  SearchQueryDto,
  UpdateCategoryDto,
  UpdateDocDto,
} from './dto/content.dto.js';
import { ReaderService } from './reader.service.js';
import { RenderService } from './render.service.js';
import { TreeService } from './tree.service.js';

const uuid = new ParseUUIDPipe();

/** Studio: cây nội dung, nhóm bài, bài viết, revision, preview. */
@ApiTags('studio')
@ApiBearerAuth()
@Controller()
export class StudioController {
  constructor(
    private readonly access: CourseAccessService,
    private readonly tree: TreeService,
    private readonly categories: CategoriesService,
    private readonly docs: DocsService,
    private readonly renderer: RenderService,
  ) {}

  @Get('versions/:versionId/tree')
  async getTree(@CurrentUser() user: AuthUser, @Param('versionId', uuid) versionId: string) {
    await this.access.requireVersion(user, versionId, CourseRole.EDITOR);
    return this.tree.studioTree(versionId);
  }

  /** Lưu kết quả kéo-thả sidebar; trả về cây mới. */
  @Patch('versions/:versionId/tree')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('versionId', uuid) versionId: string,
    @Body() dto: ReorderTreeDto,
  ) {
    return this.tree.reorder(user, versionId, dto);
  }

  @Post('versions/:versionId/categories')
  createCategory(
    @CurrentUser() user: AuthUser,
    @Param('versionId', uuid) versionId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categories.create(user, versionId, dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(user, id, dto);
  }

  @HttpCode(204)
  @Delete('categories/:id')
  removeCategory(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.categories.remove(user, id);
  }

  @Post('versions/:versionId/docs')
  createDoc(
    @CurrentUser() user: AuthUser,
    @Param('versionId', uuid) versionId: string,
    @Body() dto: CreateDocDto,
  ) {
    return this.docs.create(user, versionId, dto);
  }

  @Get('docs/:id')
  getDoc(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.docs.getForEditor(user, id);
  }

  @Patch('docs/:id')
  updateDoc(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: UpdateDocDto,
  ) {
    return this.docs.update(user, id, dto);
  }

  @HttpCode(204)
  @Delete('docs/:id')
  removeDoc(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.docs.remove(user, id);
  }

  @Put('docs/:id/draft')
  saveDraft(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: SaveDraftDto,
  ) {
    return this.docs.saveDraft(user, id, dto);
  }

  @HttpCode(200)
  @Post('docs/:id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.docs.submitForReview(user, id);
  }

  @HttpCode(200)
  @Post('docs/:id/publish')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: PublishDocDto,
  ) {
    return this.docs.publish(user, id, dto);
  }

  @HttpCode(200)
  @Post('docs/:id/unpublish')
  unpublish(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.docs.unpublish(user, id);
  }

  @HttpCode(200)
  @Post('docs/:id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.docs.setArchived(user, id, true);
  }

  @HttpCode(200)
  @Post('docs/:id/unarchive')
  unarchive(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.docs.setArchived(user, id, false);
  }

  @Get('docs/:id/revisions')
  listRevisions(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.docs.listRevisions(user, id);
  }

  @Get('docs/:id/revisions/:number')
  getRevision(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.docs.getRevision(user, id, number);
  }

  @HttpCode(200)
  @Post('docs/:id/revisions/:number/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Param('number', ParseIntPipe) number: number,
  ) {
    return this.docs.restoreRevision(user, id, number);
  }

  @HttpCode(200)
  @Post('docs/:id/lock')
  lock(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body() dto: LockDocDto,
  ) {
    return this.docs.lock(user, id, dto.force);
  }

  @HttpCode(204)
  @Delete('docs/:id/lock')
  unlock(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.docs.unlock(user, id);
  }

  /** Markdown -> HTML + TOC + cảnh báo lint cho khung preview của editor. */
  @HttpCode(200)
  @Post('render/preview')
  async preview(@CurrentUser() user: AuthUser, @Body() dto: RenderPreviewDto) {
    const { version } = await this.access.requireVersion(user, dto.versionId, CourseRole.EDITOR);
    return this.renderer.render(dto.source, {
      versionId: version.id,
      courseSlug: version.course.slug,
      versionSlug: version.slug,
    });
  }
}

/** Trang đọc của học viên. */
@ApiTags('reader')
@ApiBearerAuth()
@Controller('read')
export class ReaderController {
  constructor(private readonly reader: ReaderService) {}

  @Get(':courseSlug/tree')
  tree(
    @CurrentUser() user: AuthUser,
    @Param('courseSlug') courseSlug: string,
    @Query() query: ReadQueryDto,
  ) {
    return this.reader.getTree(user, courseSlug, query.version);
  }

  /** Tìm kiếm trong khoá học (Ctrl/⌘+K trên trang đọc). */
  @Get(':courseSlug/search')
  search(
    @CurrentUser() user: AuthUser,
    @Param('courseSlug') courseSlug: string,
    @Query() query: SearchQueryDto,
  ) {
    return this.reader.searchDocs(user, courseSlug, query.q, query.version);
  }

  @Get(':courseSlug/page')
  page(
    @CurrentUser() user: AuthUser,
    @Param('courseSlug') courseSlug: string,
    @Query() query: ReadPageQueryDto,
  ) {
    return this.reader.getPage(user, courseSlug, query.path, query.version);
  }
}
