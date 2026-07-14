import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type ICompanyRepository,
  COMPANY_REPOSITORY,
} from '../seed-demo-environment/ports/company-repository.port';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../seed-demo-environment/ports/user-repository.port';
import { type IClock, CLOCK } from '../history/ports/clock.port';
import { type IHistoryWriter, HISTORY_WRITER } from '../history/ports/history-writer.port';
import { CompanyNotFoundError } from './errors/company-not-found.error';

export type DeleteCompanyPermanentlyInput = { companyId: string };

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: borrado
 * físico e irreversible de una Company junto con todos sus recursos. En una
 * única transacción de Postgres borra, en orden (los `ON DELETE RESTRICT` del
 * esquema lo exigen): Signals y MachineConnections de cada Machine, las
 * Machines, los Users y finalmente la Company (los Dashboards se borran solos
 * vía `ON DELETE CASCADE`). Tras confirmar la transacción, borra también el
 * histórico de InfluxDB de la Company; ese borrado es best-effort (no
 * revierte ni bloquea el borrado ya confirmado en Postgres si falla), mismo
 * patrón que el envío de email en `ForgotPasswordUseCase`.
 */
@Injectable()
export class DeleteCompanyPermanentlyUseCase {
  private readonly logger = new Logger(DeleteCompanyPermanentlyUseCase.name);

  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: ICompanyRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(HISTORY_WRITER) private readonly historyWriter: IHistoryWriter,
    @Inject(CLOCK) private readonly clock: IClock,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: DeleteCompanyPermanentlyInput): Promise<void> {
    await this.unitOfWork.runInTransaction(async (ctx) => {
      const company = await this.companyRepository.findById(input.companyId, ctx);
      if (!company) {
        throw new CompanyNotFoundError(input.companyId);
      }

      const machines = await this.machineRepository.findAllByCompanyId(company.id, ctx);
      for (const machine of machines) {
        await this.signalRepository.deleteAllByMachineId(machine.id, ctx);
        await this.machineConnectionRepository.deleteByMachineId(machine.id, ctx);
      }
      await this.machineRepository.deleteAllByCompanyId(company.id, ctx);
      await this.userRepository.deleteAllByCompanyId(company.id, ctx);
      await this.companyRepository.delete(company.id, ctx);
    });

    try {
      await this.historyWriter.deleteAllForCompany(input.companyId, this.clock.now());
    } catch (error) {
      this.logger.error(
        `No se pudo borrar el histórico de InfluxDB de la Company ${input.companyId}: ${(error as Error).message}`,
      );
    }
  }
}
