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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user.js';
import { CurrentUser, SystemRoles } from '../common/decorators/auth.decorators.js';
import { CoursesService } from './courses.service.js';
import {
  AddMemberDto,
  CreateCohortDto,
  CreateCourseDto,
  EnrollLearnersDto,
  UpdateCohortDto,
  UpdateCourseDto,
  UpdateMemberDto,
} from './dto/course.dto.js';
import { MembersService } from './members.service.js';

@ApiTags('courses')
@ApiBearerAuth()
@Controller()
export class CoursesController {
  constructor(
    private readonly courses: CoursesService,
    private readonly members: MembersService,
  ) {}

  @Get('courses')
  list(@CurrentUser() user: AuthUser) {
    return this.courses.listForUser(user);
  }

  @Post('courses')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCourseDto) {
    return this.courses.create(user, dto);
  }

  /** `idOrSlug` nhận cả id lẫn slug, để web dùng thẳng slug trên URL. */
  @Get('courses/:idOrSlug')
  get(@CurrentUser() user: AuthUser, @Param('idOrSlug') idOrSlug: string) {
    return this.courses.get(user, idOrSlug);
  }

  @Patch('courses/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.update(user, id, dto);
  }

  @HttpCode(200)
  @Post('courses/:id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.courses.setArchived(user, id, true);
  }

  @HttpCode(200)
  @Post('courses/:id/unarchive')
  unarchive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.courses.setArchived(user, id, false);
  }

  @SystemRoles('ADMIN')
  @HttpCode(204)
  @Delete('courses/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.courses.remove(user, id);
  }

  @Get('courses/:id/members')
  listMembers(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.members.list(user, id);
  }

  @Post('courses/:id/members')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.members.add(user, id, dto);
  }

  @HttpCode(200)
  @Post('courses/:id/members/enroll')
  enroll(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnrollLearnersDto,
  ) {
    return this.members.enrollLearners(user, id, dto);
  }

  @Patch('courses/:id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(user, id, userId, dto);
  }

  @HttpCode(204)
  @Delete('courses/:id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.members.remove(user, id, userId);
  }

  @Get('courses/:id/cohorts')
  listCohorts(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.members.listCohorts(user, id);
  }

  @Post('courses/:id/cohorts')
  createCohort(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCohortDto,
  ) {
    return this.members.createCohort(user, id, dto);
  }

  @Patch('cohorts/:cohortId')
  updateCohort(
    @CurrentUser() user: AuthUser,
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
    @Body() dto: UpdateCohortDto,
  ) {
    return this.members.updateCohort(user, cohortId, dto);
  }

  @HttpCode(204)
  @Delete('cohorts/:cohortId')
  removeCohort(
    @CurrentUser() user: AuthUser,
    @Param('cohortId', ParseUUIDPipe) cohortId: string,
  ) {
    return this.members.removeCohort(user, cohortId);
  }
}
