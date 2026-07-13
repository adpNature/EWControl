import {
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { AlarmStateNotFoundError } from '../../../use-cases/alarms/errors/alarm-state-not-found.error';
import {
  GetAlarmStateResult,
  GetAlarmStateUseCase,
} from '../../../use-cases/alarms/get-alarm-state.use-case';
import {
  ListAlarmStatesResult,
  ListAlarmStatesUseCase,
} from '../../../use-cases/alarms/list-alarm-states.use-case';
import { AlarmStateQueryDto } from './alarm-state-query.dto';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/** docs/specs/09-alarmas.md, docs/11-api-rest.md sección "AlarmState" — solo lectura. */
@Controller('alarm-states')
export class AlarmStateController {
  constructor(
    private readonly listAlarmStatesUseCase: ListAlarmStatesUseCase,
    private readonly getAlarmStateUseCase: GetAlarmStateUseCase,
  ) {}

  @Get()
  async list(
    @Query() query: AlarmStateQueryDto,
    @currentUser() user: CurrentUser,
  ): Promise<ListAlarmStatesResult> {
    try {
      return await this.listAlarmStatesUseCase.execute({
        requester: { companyId: user.companyId, role: user.role },
        filter: { status: query.status, machineId: query.machineId, priority: query.priority },
        pagination: {
          limit: query.limit ?? DEFAULT_LIMIT,
          offset: query.offset ?? DEFAULT_OFFSET,
        },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @currentUser() user: CurrentUser,
  ): Promise<GetAlarmStateResult> {
    try {
      return await this.getAlarmStateUseCase.execute({
        alarmStateId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof AlarmStateNotFoundError) {
      return new NotFoundException({ code: 'ALARM_STATE_NOT_FOUND', message: error.message });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
