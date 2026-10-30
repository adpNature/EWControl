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
} from '@nestjs/common';
import { CONFIGURATION_ROLES, roles } from '../../auth-guard/roles.decorator';
import { AlarmDefinition } from '../../../entities/alarm-definition.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { AlarmDefinitionNotFoundError } from '../../../use-cases/alarms/errors/alarm-definition-not-found.error';
import { DeactivateAlarmDefinitionUseCase } from '../../../use-cases/alarms/deactivate-alarm-definition.use-case';
import { UpdateAlarmDefinitionUseCase } from '../../../use-cases/alarms/update-alarm-definition.use-case';
import { UpdateAlarmDefinitionDto } from './update-alarm-definition.dto';

/**
 * docs/specs/09-alarmas.md, docs/11-api-rest.md sección "AlarmDefinition".
 * Prefijo `alarm-definitions` (sin `signalId`, inmutable tras la creación),
 * en una clase distinta a `AlarmDefinitionController` porque Nest no admite
 * dos prefijos `@Controller()` en una misma clase.
 */
@roles(...CONFIGURATION_ROLES)
@Controller('alarm-definitions')
export class AlarmDefinitionMutationController {
  constructor(
    private readonly updateAlarmDefinitionUseCase: UpdateAlarmDefinitionUseCase,
    private readonly deactivateAlarmDefinitionUseCase: DeactivateAlarmDefinitionUseCase,
  ) {}

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAlarmDefinitionDto,
    @currentUser() user: CurrentUser,
  ): Promise<AlarmDefinition> {
    try {
      return await this.updateAlarmDefinitionUseCase.execute({
        alarmDefinitionId: id,
        requester: { companyId: user.companyId, role: user.role },
        changes: dto,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @currentUser() user: CurrentUser): Promise<void> {
    try {
      await this.deactivateAlarmDefinitionUseCase.execute({
        alarmDefinitionId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof AlarmDefinitionNotFoundError) {
      return new NotFoundException({ code: 'ALARM_DEFINITION_NOT_FOUND', message: error.message });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
