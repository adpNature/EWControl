import { Inject, Injectable } from '@nestjs/common';
import { COMPANY_REPOSITORY, type ICompanyRepository } from './ports/company-repository.port';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from './ports/machine-connection-repository.port';
import { type IMachineRepository, MACHINE_REPOSITORY } from './ports/machine-repository.port';
import { type IPasswordHasher, PASSWORD_HASHER } from './ports/password-hasher.port';
import {
  type ISchemaReadinessChecker,
  SCHEMA_READINESS_CHECKER,
} from './ports/schema-readiness-checker.port';
import { type ISignalRepository, SIGNAL_REPOSITORY } from './ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from './ports/unit-of-work.port';
import { type IUserRepository, USER_REPOSITORY } from './ports/user-repository.port';
import {
  SEED_COMPANY_NAME,
  SEED_CONNECTION_CONFIG,
  SEED_MACHINE_NAME,
  SEED_MACHINE_PROVIDER_TYPE,
  SEED_SIGNAL_HISTORY_ENABLED,
  SEED_SIGNAL_TYPE,
  SEED_SIGNALS,
  SEED_USER_EMAIL,
  SEED_USER_PASSWORD,
  SEED_USER_ROLE,
} from './seed-demo-environment.config';

export type SeedDemoEnvironmentResult = { created: boolean };

/**
 * Caso de uso de la spec 01-fundacion-entorno-demo.md: crea, en una única
 * transacción e idempotentemente, el entorno demo completo (Company, User,
 * Machine, MachineConnection Simulator y sus 6 Signals).
 */
@Injectable()
export class SeedDemoEnvironmentUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: ICompanyRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(SCHEMA_READINESS_CHECKER)
    private readonly schemaReadinessChecker: ISchemaReadinessChecker,
  ) {}

  async execute(): Promise<SeedDemoEnvironmentResult> {
    await this.schemaReadinessChecker.ensureReady();

    return this.unitOfWork.runInTransaction(async (ctx) => {
      const existing = await this.companyRepository.findByName(SEED_COMPANY_NAME, ctx);
      if (existing) {
        return { created: false };
      }

      const company = await this.companyRepository.create({ name: SEED_COMPANY_NAME }, ctx);

      const passwordHash = await this.passwordHasher.hash(SEED_USER_PASSWORD);
      await this.userRepository.create(
        { companyId: company.id, email: SEED_USER_EMAIL, passwordHash, role: SEED_USER_ROLE },
        ctx,
      );

      const machine = await this.machineRepository.create(
        { companyId: company.id, name: SEED_MACHINE_NAME },
        ctx,
      );

      await this.machineConnectionRepository.create(
        {
          machineId: machine.id,
          providerType: SEED_MACHINE_PROVIDER_TYPE,
          connectionConfig: SEED_CONNECTION_CONFIG,
        },
        ctx,
      );

      for (const seedSignal of SEED_SIGNALS) {
        await this.signalRepository.create(
          {
            machineId: machine.id,
            name: seedSignal.name,
            signalType: SEED_SIGNAL_TYPE,
            signalSource: { variableName: seedSignal.name },
            unit: seedSignal.unit,
            historyEnabled: SEED_SIGNAL_HISTORY_ENABLED,
          },
          ctx,
        );
      }

      return { created: true };
    });
  }
}
