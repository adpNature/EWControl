import { Inject, Injectable } from '@nestjs/common';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { AlarmDefinitionAccessResolver, Requester } from './alarm-definition-access.resolver';
import {
  ALARM_DEFINITION_REPOSITORY,
  type IAlarmDefinitionRepository,
} from './ports/alarm-definition-repository.port';

export type DeactivateAlarmDefinitionInput = { alarmDefinitionId: string; requester: Requester };

/**
 * docs/specs/09-alarmas.md, backend: `DELETE /alarm-definitions/:id` — baja
 * lógica (Documento 3, apartado 3.2.6, Regla 3): una regla desactivada no
 * genera nuevos AlarmState, pero su histórico previo permanece intacto.
 */
@Injectable()
export class DeactivateAlarmDefinitionUseCase {
  constructor(
    private readonly resolver: AlarmDefinitionAccessResolver,
    @Inject(ALARM_DEFINITION_REPOSITORY)
    private readonly alarmDefinitionRepository: IAlarmDefinitionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: DeactivateAlarmDefinitionInput): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const definition = await this.resolver.resolveAny(
        input.alarmDefinitionId,
        input.requester,
        ctx,
      );
      await this.alarmDefinitionRepository.deactivate(definition.id, ctx);
    });
  }
}
