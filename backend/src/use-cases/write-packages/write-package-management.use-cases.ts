import { Inject, Injectable } from '@nestjs/common';
import type { WritePackageExecution } from '../../entities/write-package-execution.entity';
import type { WritePackage } from '../../entities/write-package.entity';
import { type WritePackageItem, validateWritePackageItems } from '../../entities/write-package.vo';
import type { Requester } from '../machine-management/machine-access.resolver';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import type { ProviderType } from '../../entities/provider-type.enum';
import { InvalidWritePackageError } from './errors/invalid-write-package.error';
import { type IMachineWriter, MACHINE_WRITER } from './ports/machine-writer.port';
import { WritePackageNameTakenError } from './errors/write-package-name-taken.error';
import {
  type IWritePackageExecutionRepository,
  WRITE_PACKAGE_EXECUTION_REPOSITORY,
} from './ports/write-package-execution-repository.port';
import {
  type IWritePackageRepository,
  WRITE_PACKAGE_REPOSITORY,
} from './ports/write-package-repository.port';
import { NO_CONNECTION_CONFIG, WritePackageAccessResolver } from './write-package-access.resolver';

export type CreateWritePackageInput = {
  machineId: string;
  requester: Requester;
  name: string;
  description?: string | null;
  items: WritePackageItem[];
};

export type UpdateWritePackageInput = {
  machineId: string;
  packageId: string;
  requester: Requester;
  changes: { name?: string; description?: string | null; items?: WritePackageItem[] };
};

export type WritePackageRef = { machineId: string; packageId: string; requester: Requester };

/** Paquetes de una Machine junto con si se pueden ejecutar ahora (spec 20, criterio frontend 6). */
export type WritePackageList = {
  providerType: ProviderType | null;
  connected: boolean;
  packages: WritePackage[];
};

/**
 * docs/specs/20-paquetes-escritura-opc-ua.md, criterio backend 2: alta de un
 * paquete validado contra las variables escribibles de la Machine.
 */
@Injectable()
export class CreateWritePackageUseCase {
  constructor(
    private readonly access: WritePackageAccessResolver,
    @Inject(WRITE_PACKAGE_REPOSITORY) private readonly repository: IWritePackageRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  /** @throws InvalidWritePackageError / WritePackageNameTakenError / MachineNotFoundError */
  execute(input: CreateWritePackageInput): Promise<WritePackage> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, connectionConfig } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      assertValidItems(input.items, connectionConfig);
      const name = input.name.trim();
      if (await this.repository.findActiveByMachineAndName(machine.id, name, ctx)) {
        throw new WritePackageNameTakenError(name);
      }
      return this.repository.create(
        {
          machineId: machine.id,
          name,
          description: input.description ?? null,
          items: input.items,
        },
        ctx,
      );
    });
  }
}

/** spec 20, criterio backend 2: edición con la misma validación que el alta. */
@Injectable()
export class UpdateWritePackageUseCase {
  constructor(
    private readonly access: WritePackageAccessResolver,
    @Inject(WRITE_PACKAGE_REPOSITORY) private readonly repository: IWritePackageRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  /** @throws InvalidWritePackageError / WritePackageNameTakenError / WritePackageNotFoundError / MachineNotFoundError */
  execute(input: UpdateWritePackageInput): Promise<WritePackage> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, connectionConfig } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      const current = await this.access.resolvePackage(machine.id, input.packageId, ctx);
      if (input.changes.items) {
        assertValidItems(input.changes.items, connectionConfig);
      }
      const name = input.changes.name?.trim();
      if (name && name !== current.name) {
        const existing = await this.repository.findActiveByMachineAndName(machine.id, name, ctx);
        if (existing && existing.id !== current.id) {
          throw new WritePackageNameTakenError(name);
        }
      }
      return this.repository.update(
        current.id,
        { ...input.changes, ...(name ? { name } : {}) },
        ctx,
      );
    });
  }
}

/** Baja lógica: el paquete deja de poder ejecutarse, su historial se conserva. */
@Injectable()
export class DeactivateWritePackageUseCase {
  constructor(
    private readonly access: WritePackageAccessResolver,
    @Inject(WRITE_PACKAGE_REPOSITORY) private readonly repository: IWritePackageRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  /** @throws WritePackageNotFoundError / MachineNotFoundError */
  execute(input: WritePackageRef): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine } = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const writePackage = await this.access.resolvePackage(machine.id, input.packageId, ctx);
      await this.repository.deactivate(writePackage.id, ctx);
    });
  }
}

/**
 * spec 20, criterio backend 3: paquetes activos de una Machine, para los tres
 * roles, junto con su proveedor y si está conectada ahora mismo.
 */
@Injectable()
export class ListWritePackagesUseCase {
  constructor(
    private readonly access: WritePackageAccessResolver,
    @Inject(WRITE_PACKAGE_REPOSITORY) private readonly repository: IWritePackageRepository,
    @Inject(MACHINE_WRITER) private readonly machineWriter: IMachineWriter,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: { machineId: string; requester: Requester }): Promise<WritePackageList> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine, providerType } = await this.access.resolveMachine(
        input.machineId,
        input.requester,
        ctx,
      );
      const packages = await this.repository.listActiveByMachine(machine.id, ctx);
      return { providerType, connected: this.machineWriter.isConnected(machine.id), packages };
    });
  }
}

@Injectable()
export class GetWritePackageUseCase {
  constructor(
    private readonly access: WritePackageAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: WritePackageRef): Promise<WritePackage> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine } = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      return this.access.resolvePackage(machine.id, input.packageId, ctx);
    });
  }
}

/** spec 20, criterio backend 8: historial de ejecuciones, también de paquetes dados de baja. */
@Injectable()
export class ListWritePackageExecutionsUseCase {
  constructor(
    private readonly access: WritePackageAccessResolver,
    @Inject(WRITE_PACKAGE_EXECUTION_REPOSITORY)
    private readonly executionRepository: IWritePackageExecutionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(
    input: WritePackageRef & { pagination: { limit: number; offset: number } },
  ): Promise<{ data: WritePackageExecution[]; total: number; limit: number; offset: number }> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const { machine } = await this.access.resolveMachine(input.machineId, input.requester, ctx);
      const writePackage = await this.access.resolvePackage(machine.id, input.packageId, ctx, {
        activeOnly: false,
      });
      const page = await this.executionRepository.listByPackage(
        writePackage.id,
        input.pagination,
        ctx,
      );
      return { ...page, ...input.pagination };
    });
  }
}

function assertValidItems(
  items: WritePackageItem[],
  connectionConfig: Parameters<typeof validateWritePackageItems>[1] | null,
): void {
  const validation = validateWritePackageItems(items, connectionConfig ?? NO_CONNECTION_CONFIG);
  if (!validation.ok) {
    throw new InvalidWritePackageError(validation.reason, validation.index);
  }
}
