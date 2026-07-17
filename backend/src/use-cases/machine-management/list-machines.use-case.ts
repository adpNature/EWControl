import { Inject, Injectable } from '@nestjs/common';
import { Machine } from '../../entities/machine.entity';
import { UserRole } from '../../entities/user-role.enum';
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
export type ListMachinesResult = {
  data: Machine[];
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
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: ListMachinesInput): Promise<ListMachinesResult> {
    const companyId =
      input.requester.role === UserRole.SuperAdmin
        ? (input.companyId ?? null)
        : input.requester.companyId;
    const { data, total } = await this.unitOfWork.runInTransaction((ctx) =>
      this.machineRepository.list({ companyId, isActive: true }, input.pagination, ctx),
    );
    return { data, total, limit: input.pagination.limit, offset: input.pagination.offset };
  }
}
