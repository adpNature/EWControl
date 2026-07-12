import { Inject, Injectable } from '@nestjs/common';
import { EVENT_PUBLISHER, type IEventPublisher } from './ports/event-publisher.port';
import { type ISimulatorRuntime, SIMULATOR_RUNTIME } from './ports/simulator-runtime.port';
import { SimulatorMachineResolver } from './simulator-machine-resolver';

/**
 * spec 03-simulador-forzar-fallo.md, criterio de aceptación 1: fuerza la
 * desconexión del Simulador de una Machine e informa mediante `MachineDisconnected`.
 * Idempotente: si ya estaba desconectada, no repite el efecto ni el evento.
 */
@Injectable()
export class ForceDisconnectSimulatorUseCase {
  constructor(
    private readonly resolver: SimulatorMachineResolver,
    @Inject(SIMULATOR_RUNTIME) private readonly simulatorRuntime: ISimulatorRuntime,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  async execute(machineId: string): Promise<void> {
    const { machine } = await this.resolver.resolve(machineId);

    if (!this.simulatorRuntime.isConnected(machineId)) {
      return;
    }

    await this.simulatorRuntime.disconnect(machineId);
    this.eventPublisher.publish('MachineDisconnected', {
      machineId,
      companyId: machine.companyId,
      timestamp: new Date(),
    });
  }
}
