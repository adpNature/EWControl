import { Inject, Injectable } from '@nestjs/common';
import { EVENT_PUBLISHER, type IEventPublisher } from './ports/event-publisher.port';
import { type ISimulatorRuntime, SIMULATOR_RUNTIME } from './ports/simulator-runtime.port';
import { SimulatorMachineResolver } from './simulator-machine-resolver';

/**
 * spec 03-simulador-forzar-fallo.md, criterio de aceptación 2: revierte una
 * desconexión forzada, retomando la generación de lecturas y publicando
 * `MachineConnected`. Idempotente por simetría con force-disconnect, aunque
 * no lo exige literalmente ningún criterio de aceptación.
 */
@Injectable()
export class ReconnectSimulatorUseCase {
  constructor(
    private readonly resolver: SimulatorMachineResolver,
    @Inject(SIMULATOR_RUNTIME) private readonly simulatorRuntime: ISimulatorRuntime,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(machineId: string): Promise<void> {
    const { machine } = await this.resolver.resolve(machineId);

    if (this.simulatorRuntime.isConnected(machineId)) {
      return;
    }

    await this.simulatorRuntime.connect(machineId);
    this.eventPublisher.publish('MachineConnected', {
      machineId,
      companyId: machine.companyId,
      timestamp: new Date(),
    });
  }
}
