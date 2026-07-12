import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { MachineDisconnectedPayload } from '../../use-cases/simulator-control/ports/event-publisher.port';
import { MarkMachineSignalsOfflineUseCase } from '../../use-cases/dashboard/mark-machine-signals-offline.use-case';

/**
 * docs/specs/07-dashboard-tiempo-real.md: primer `@OnEvent` del proyecto. Al
 * desconectarse una Machine (spec 03), marca OFFLINE en la Realtime Cache
 * todas sus Signals con entrada existente, para que el Dashboard refleje la
 * pérdida de comunicación sin sondeo (Documento 2, apartado 2.6).
 */
@Injectable()
export class MachineDisconnectedListener {
  constructor(private readonly markSignalsOffline: MarkMachineSignalsOfflineUseCase) {}

  @OnEvent('MachineDisconnected')
  handle(payload: MachineDisconnectedPayload): Promise<void> {
    return this.markSignalsOffline.execute({
      machineId: payload.machineId,
      companyId: payload.companyId,
    });
  }
}
