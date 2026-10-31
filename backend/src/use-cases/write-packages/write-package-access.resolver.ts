import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionConfig } from '../../entities/connection-config.vo';
import type { Machine } from '../../entities/machine.entity';
import type { ProviderType } from '../../entities/provider-type.enum';
import type { WritePackage } from '../../entities/write-package.entity';
import { MachineAccessResolver, Requester } from '../machine-management/machine-access.resolver';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { WritePackageNotFoundError } from './errors/write-package-not-found.error';
import {
  type IWritePackageRepository,
  WRITE_PACKAGE_REPOSITORY,
} from './ports/write-package-repository.port';

export type MachineWithConnection = {
  machine: Machine;
  providerType: ProviderType | null;
  /** `null` si la Machine no tiene MachineConnection: ninguna variable es escribible. */
  connectionConfig: ConnectionConfig | null;
};

/** Config vacía del Simulador: equivale a "ninguna variable escribible". */
export const NO_CONNECTION_CONFIG: ConnectionConfig = { seedProfile: 'empty', signals: [] };

/**
 * Acceso común de docs/specs/20-paquetes-escritura-opc-ua.md: la Machine
 * activa del requester (otra Company o inactiva: `404`, igual que el resto de
 * `machine-management`), su conexión y, en su caso, el paquete, que debe
 * pertenecer a esa Machine.
 */
@Injectable()
export class WritePackageAccessResolver {
  constructor(
    private readonly machineAccessResolver: MachineAccessResolver,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(WRITE_PACKAGE_REPOSITORY)
    private readonly writePackageRepository: IWritePackageRepository,
  ) {}

  /** @throws MachineNotFoundError */
  async resolveMachine(
    machineId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<MachineWithConnection> {
    const machine = await this.machineAccessResolver.resolveActive(machineId, requester, ctx);
    const connection = await this.machineConnectionRepository.findByMachineId(machine.id, ctx);
    return {
      machine,
      providerType: connection?.providerType ?? null,
      connectionConfig: connection?.connectionConfig ?? null,
    };
  }

  /**
   * @param options.activeOnly `false` para el historial: las ejecuciones de un
   *   paquete dado de baja se siguen pudiendo consultar.
   * @throws WritePackageNotFoundError si no existe, es de otra Machine o (con `activeOnly`) está de baja.
   */
  async resolvePackage(
    machineId: string,
    packageId: string,
    ctx: TransactionContext,
    options: { activeOnly: boolean } = { activeOnly: true },
  ): Promise<WritePackage> {
    const writePackage = await this.writePackageRepository.findById(packageId, ctx);
    if (
      !writePackage ||
      writePackage.machineId !== machineId ||
      (options.activeOnly && !writePackage.isActive)
    ) {
      throw new WritePackageNotFoundError(packageId);
    }
    return writePackage;
  }
}
