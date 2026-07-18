import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlarmState } from '../../entities/alarm-state.entity';
import { AlarmStateType } from '../../entities/alarm-state-type.enum';

/**
 * Gauge `ewcontrol_alarm_active_total` (docs/07-observabilidad-monitorizacion.md,
 * apartado 7.3; spec 15): cuenta directo sobre `alarm_states`, barato gracias al
 * índice `@Index(['status'])` (`entities/alarm-state.entity.ts`). No pasa por
 * `IAlarmStateRepository` (pensado para casos de uso con `TransactionContext`);
 * es un colector de infraestructura pura, sin lógica de negocio.
 */
@Injectable()
export class AlarmActiveCollector {
  constructor(@InjectRepository(AlarmState) private readonly repository: Repository<AlarmState>) {}

  countActive(): Promise<number> {
    return this.repository.count({ where: { status: AlarmStateType.Active } });
  }
}
