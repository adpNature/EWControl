import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CONFIGURATION_ROLES, roles } from '../../auth-guard/roles.decorator';
import { DashboardWidget } from '../../../entities/dashboard-widget.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { CreateWidgetUseCase } from '../../../use-cases/dashboard/create-widget.use-case';
import { DeleteWidgetUseCase } from '../../../use-cases/dashboard/delete-widget.use-case';
import { DashboardNotFoundError } from '../../../use-cases/dashboard/errors/dashboard-not-found.error';
import { SignalNotFoundForWidgetError } from '../../../use-cases/dashboard/errors/signal-not-found-for-widget.error';
import { WidgetNotFoundError } from '../../../use-cases/dashboard/errors/widget-not-found.error';
import { UpdateWidgetUseCase } from '../../../use-cases/dashboard/update-widget.use-case';
import { CreateWidgetDto } from './create-widget.dto';
import { UpdateWidgetDto } from './update-widget.dto';

/** docs/specs/07-dashboard-tiempo-real.md, docs/11-api-rest.md sección "Dashboard / DashboardWidget". */
@roles(...CONFIGURATION_ROLES)
@Controller('dashboards/:dashboardId/widgets')
export class DashboardWidgetController {
  constructor(
    private readonly createWidgetUseCase: CreateWidgetUseCase,
    private readonly updateWidgetUseCase: UpdateWidgetUseCase,
    private readonly deleteWidgetUseCase: DeleteWidgetUseCase,
  ) {}

  @Post()
  async create(
    @Param('dashboardId') dashboardId: string,
    @Body() dto: CreateWidgetDto,
    @currentUser() user: CurrentUser,
  ): Promise<DashboardWidget> {
    try {
      return await this.createWidgetUseCase.execute({
        dashboardId,
        requester: { companyId: user.companyId, role: user.role },
        widgetType: dto.widgetType,
        widgetConfig: dto.config,
        signalIds: dto.signalIds,
        position: dto.position,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Patch(':widgetId')
  async update(
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @Body() dto: UpdateWidgetDto,
    @currentUser() user: CurrentUser,
  ): Promise<DashboardWidget> {
    try {
      return await this.updateWidgetUseCase.execute({
        dashboardId,
        widgetId,
        requester: { companyId: user.companyId, role: user.role },
        widgetConfig: dto.config as never,
        signalIds: dto.signalIds,
        position: dto.position,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Delete(':widgetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('dashboardId') dashboardId: string,
    @Param('widgetId') widgetId: string,
    @currentUser() user: CurrentUser,
  ): Promise<void> {
    try {
      await this.deleteWidgetUseCase.execute({
        dashboardId,
        widgetId,
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
    if (error instanceof WidgetNotFoundError) {
      return new NotFoundException({ code: 'WIDGET_NOT_FOUND', message: error.message });
    }
    if (error instanceof SignalNotFoundForWidgetError) {
      return new UnprocessableEntityException({
        code: 'SIGNAL_NOT_FOUND_FOR_WIDGET',
        message: error.message,
        details: { signalIds: error.signalIds },
      });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
