import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CONFIGURATION_ROLES, roles } from '../../auth-guard/roles.decorator';
import { Dashboard } from '../../../entities/dashboard.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { CreateDashboardUseCase } from '../../../use-cases/dashboard/create-dashboard.use-case';
import {
  DashboardDetail,
  GetDashboardUseCase,
} from '../../../use-cases/dashboard/get-dashboard.use-case';
import { DeleteDashboardUseCase } from '../../../use-cases/dashboard/delete-dashboard.use-case';
import { DashboardNotFoundError } from '../../../use-cases/dashboard/errors/dashboard-not-found.error';
import {
  ListDashboardsResult,
  ListDashboardsUseCase,
} from '../../../use-cases/dashboard/list-dashboards.use-case';
import { UpdateDashboardUseCase } from '../../../use-cases/dashboard/update-dashboard.use-case';
import { PaginationQueryDto } from '../shared/pagination-query.dto';
import { CreateDashboardDto } from './create-dashboard.dto';
import { UpdateDashboardDto } from './update-dashboard.dto';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/** docs/specs/07-dashboard-tiempo-real.md, docs/11-api-rest.md sección "Dashboard / DashboardWidget". */
@Controller('dashboards')
export class DashboardController {
  constructor(
    private readonly createDashboardUseCase: CreateDashboardUseCase,
    private readonly listDashboardsUseCase: ListDashboardsUseCase,
    private readonly getDashboardUseCase: GetDashboardUseCase,
    private readonly updateDashboardUseCase: UpdateDashboardUseCase,
    private readonly deleteDashboardUseCase: DeleteDashboardUseCase,
  ) {}

  @roles(...CONFIGURATION_ROLES)
  @Post()
  async create(
    @Body() dto: CreateDashboardDto,
    @currentUser() user: CurrentUser,
  ): Promise<Dashboard> {
    try {
      return await this.createDashboardUseCase.execute({
        companyId: user.companyId,
        name: dto.name,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get()
  async list(
    @Query() query: PaginationQueryDto,
    @currentUser() user: CurrentUser,
  ): Promise<ListDashboardsResult> {
    try {
      return await this.listDashboardsUseCase.execute({
        requester: { companyId: user.companyId, role: user.role },
        pagination: { limit: query.limit ?? DEFAULT_LIMIT, offset: query.offset ?? DEFAULT_OFFSET },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get(':id')
  async get(@Param('id') id: string, @currentUser() user: CurrentUser): Promise<DashboardDetail> {
    try {
      return await this.getDashboardUseCase.execute({
        dashboardId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @roles(...CONFIGURATION_ROLES)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDashboardDto,
    @currentUser() user: CurrentUser,
  ): Promise<Dashboard> {
    try {
      return await this.updateDashboardUseCase.execute({
        dashboardId: id,
        requester: { companyId: user.companyId, role: user.role },
        name: dto.name,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @roles(...CONFIGURATION_ROLES)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @currentUser() user: CurrentUser): Promise<void> {
    try {
      await this.deleteDashboardUseCase.execute({
        dashboardId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof DashboardNotFoundError) {
      return new NotFoundException({ code: 'DASHBOARD_NOT_FOUND', message: error.message });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
