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
}
