import { ConnectionConfig } from '../../../entities/connection-config.vo';
import { MachineConnection } from '../../../entities/machine-connection.entity';
import { ProviderType } from '../../../entities/provider-type.enum';
import { TransactionContext } from './transaction-context';

export const MACHINE_CONNECTION_REPOSITORY = Symbol('MachineConnectionRepository');

export interface IMachineConnectionRepository {
  create(
    data: { machineId: string; providerType: ProviderType; connectionConfig: ConnectionConfig },
    ctx: TransactionContext,
  ): Promise<MachineConnection>;
  findByMachineId(machineId: string, ctx: TransactionContext): Promise<MachineConnection | null>;
  findAllByProviderType(
    providerType: ProviderType,
    ctx: TransactionContext,
  ): Promise<MachineConnection[]>;
  replace(
    machineId: string,
    changes: { providerType: ProviderType; connectionConfig: ConnectionConfig },
    ctx: TransactionContext,
  ): Promise<MachineConnection>;
  /** Borrado físico (docs/specs/10-gestion-companies-users.md, "purge" de Company). */
  deleteByMachineId(machineId: string, ctx: TransactionContext): Promise<void>;
}
