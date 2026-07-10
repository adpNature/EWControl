import { Inject, Injectable } from '@nestjs/common';
import { Machine } from '../../entities/machine.entity';
import { UserRole } from '../../entities/user-role.enum';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { MachineInactiveError } from './errors/machine-inactive.error';
import { MachineNotFoundError } from './errors/machine-not-found.error';

export type Requester = { companyId: string; role: UserRole };

/**
 * Centraliza el aislamiento multiempresa de Machine (docs/06-seguridad-global.md, 6.7):
 * un recurso inexistente, de otra Company, o inactivo responde siempre 404
 * (MachineNotFoundError), nunca 403, para no confirmar su existencia (OWASP A01).
 * Solo un SuperAdmin cruza el límite de Company.
 */
@Injectable()
export class MachineAccessResolver {
  constructor(@Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository) {}

  async resolveAny(
    machineId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<Machine> {
    const machine = await this.machineRepository.findById(machineId, ctx);
    if (!machine || !this.belongsToRequester(machine, requester)) {
      throw new MachineNotFoundError(machineId);
    }
    return machine;
  }

  async resolveActive(
    machineId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<Machine> {
    const machine = await this.resolveAny(machineId, requester, ctx);
    if (!machine.isActive) {
      throw new MachineNotFoundError(machineId);
    }
    return machine;
  }

  private belongsToRequester(machine: Machine, requester: Requester): boolean {
    return requester.role === UserRole.SuperAdmin || machine.companyId === requester.companyId;
  }
}

export function assertMachineActive(machine: Machine): void {
  if (!machine.isActive) {
    throw new MachineInactiveError(machine.id);
  }
}
