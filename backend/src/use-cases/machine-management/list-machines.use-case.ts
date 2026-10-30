import { Inject, Injectable } from '@nestjs/common';
import { Machine } from '../../entities/machine.entity';
import { ProviderType } from '../../entities/provider-type.enum';
import { UserRole } from '../../entities/user-role.enum';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { Requester } from './machine-access.resolver';

export type ListMachinesInput = {
  requester: Requester;
  /** docs/08-frontend-dashboard.md, 8.8: filtro del switcher de Company de un SuperAdmin. Ignorado para AdminCliente. */
  companyId?: string;
  pagination: { limit: number; offset: number };
};
/**
 * Machine con el `providerType` de su MachineConnection (docs/specs/18-integracion-opc-ua.md,
 * criterio backend 12), para que la UI muestre el tipo de conexión real. `null` si no tiene conexión.
 */
export type MachineWithProvider = Machine & { providerType: ProviderType | null };

export type ListMachinesResult = {
  data: MachineWithProvider[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * docs/specs/06-gestion-machines-signals.md, criterios de aceptación backend 2 y 6:
 * solo Machines activas de la Company del requester (un SuperAdmin ve todas).
 */
@Injectable()
export class ListMachinesUseCase {
  constructor(
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: ListMachinesInput): Promise<ListMachinesResult> {
    const companyId =
      input.requester.role === UserRole.SuperAdmin
        ? (input.companyId ?? null)
        : input.requester.companyId;
    const { data, total } = await this.unitOfWork.runInTransaction(async (ctx) => {
      const page = await this.machineRepository.list(
        { companyId, isActive: true },
        input.pagination,
        ctx,
      );
      const connections = await this.machineConnectionRepository.findByMachineIds(
        page.data.map((machine) => machine.id),
        ctx,
      );
      const providerByMachineId = new Map(
        connections.map((connection) => [connection.machineId, connection.providerType]),
      );
      return {
        data: page.data.map((machine) => ({
          ...machine,
          providerType: providerByMachineId.get(machine.id) ?? null,
        })),
        total: page.total,
      };
    });
    return { data, total, limit: input.pagination.limit, offset: input.pagination.offset };
  }
}
