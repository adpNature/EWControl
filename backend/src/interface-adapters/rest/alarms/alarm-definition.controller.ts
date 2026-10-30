import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CONFIGURATION_ROLES, roles } from '../../auth-guard/roles.decorator';
import { AlarmDefinition } from '../../../entities/alarm-definition.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { CreateAlarmDefinitionUseCase } from '../../../use-cases/alarms/create-alarm-definition.use-case';
import { SignalNotFoundError } from '../../../use-cases/alarms/errors/signal-not-found.error';
import { ListAlarmDefinitionsUseCase } from '../../../use-cases/alarms/list-alarm-definitions.use-case';
import { CreateAlarmDefinitionDto } from './create-alarm-definition.dto';

/** docs/specs/09-alarmas.md, docs/11-api-rest.md sección "AlarmDefinition". */
@Controller('signals/:signalId/alarm-definitions')
export class AlarmDefinitionController {
  constructor(
    private readonly createAlarmDefinitionUseCase: CreateAlarmDefinitionUseCase,
    private readonly listAlarmDefinitionsUseCase: ListAlarmDefinitionsUseCase,
  ) {}

  @roles(...CONFIGURATION_ROLES)
  @Post()
  async create(
    @Param('signalId') signalId: string,
    @Body() dto: CreateAlarmDefinitionDto,
    @currentUser() user: CurrentUser,
  ): Promise<AlarmDefinition> {
    try {
      return await this.createAlarmDefinitionUseCase.execute({
        signalId,
        requester: { companyId: user.companyId, role: user.role },
        operator: dto.operator,
        threshold: dto.threshold,
        priority: dto.priority,
        notifyByEmail: dto.notifyByEmail,
        showOnDashboard: dto.showOnDashboard,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get()
  async list(
    @Param('signalId') signalId: string,
    @currentUser() user: CurrentUser,
  ): Promise<AlarmDefinition[]> {
    try {
      return await this.listAlarmDefinitionsUseCase.execute({
        signalId,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof SignalNotFoundError) {
      return new NotFoundException({ code: 'SIGNAL_NOT_FOUND', message: error.message });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
