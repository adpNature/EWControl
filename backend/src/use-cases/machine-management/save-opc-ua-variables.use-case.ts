import { Inject, Injectable } from '@nestjs/common';
import {
  MAX_NODE_MAPPING_ENTRIES,
  type OpcUaConnectionConfig,
  parseOpcUaConnectionConfig,
} from '../../entities/connection-config.vo';
import { MachineConnection } from '../../entities/machine-connection.entity';
import { mergeSyncedVariables, type VariableToSave } from '../../entities/opc-ua-variable-sync';
import { ProviderType } from '../../entities/provider-type.enum';
import { isFormulaSignalSource } from '../../entities/signal-source.vo';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  EVENT_PUBLISHER,
  type IEventPublisher,
} from '../simulator-control/ports/event-publisher.port';
import {
  type IWritePackageRepository,
  WRITE_PACKAGE_REPOSITORY,
} from '../write-packages/ports/write-package-repository.port';
import { InvalidConnectionConfigError } from './errors/invalid-connection-config.error';
import { OpcUaMappingLimitError } from './errors/opc-ua-mapping-limit.error';
import { type VariableInUse, OpcUaVariableInUseError } from './errors/opc-ua-variable-in-use.error';
import { MachineAccessResolver, Requester } from './machine-access.resolver';
import { OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';
import { assertValidRootNodeId, resolveOpcUaConnection } from './sync-opc-ua-variables.use-case';

export type SaveOpcUaVariablesInput = {
  machineId: string;
  requester: Requester;
  rootNodeId: string;
  variables: VariableToSave[];
  /** `nodeId` que el usuario ha marcado como «Quitar del mapeo». */
  remove: string[];
};

/**
 * docs/specs/21-sincronizacion-variables-opc-ua.md: guarda en el `nodeMapping`
 * las variables de una sincronización. Fusiona por `nodeId` sin tocar el resto
 * del mapeo, protege las variables en uso y, tras el commit, publica
 * `MachineConnectionReplaced` para que el `OpcUaProvider` se reinicie con el
 * nuevo mapeo (spec 18).
 */
@Injectable()
export class SaveOpcUaVariablesUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly connectionRepository: IMachineConnectionRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(WRITE_PACKAGE_REPOSITORY)
    private readonly writePackageRepository: IWritePackageRepository,
    private readonly endpointPolicy: OpcUaEndpointPolicy,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  /**
   * @throws OpcUaInvalidNodeIdError si `rootNodeId` está vacío o es demasiado largo.
   * @throws MachineNotFoundError / MachineNotOpcUaError.
   * @throws OpcUaEndpointNotAllowedError si el endpoint guardado ya no está permitido.
   * @throws OpcUaMappingLimitError si el mapeo superaría `MAX_NODE_MAPPING_ENTRIES`.
   * @throws InvalidConnectionConfigError si el mapeo resultante no es válido.
   * @throws OpcUaVariableInUseError si se renombra o quita una variable en uso.
   */
  async execute(input: SaveOpcUaVariablesInput): Promise<MachineConnection> {
    assertValidRootNodeId(input.rootNodeId);
    const { connection, companyId } = await this.unitOfWork.runInTransaction(async (ctx) => {
      const resolved = await resolveOpcUaConnection(
        this.resolver,
        this.connectionRepository,
        input.machineId,
        input.requester,
        ctx,
      );
      this.endpointPolicy.assertAllowed(resolved.config.endpointUrl);
      const { config, lostNames } = this.buildConfig(resolved.config, input);
      await this.assertNotInUse(input.machineId, lostNames, ctx);
      const replaced = await this.connectionRepository.replace(
        input.machineId,
        { providerType: ProviderType.OpcUa, connectionConfig: config },
        ctx,
      );
      return { connection: replaced, companyId: resolved.companyId };
    });

    this.eventPublisher.publish('MachineConnectionReplaced', {
      machineId: connection.machineId,
      companyId,
      previousProviderType: ProviderType.OpcUa,
      providerType: ProviderType.OpcUa,
    });
    return connection;
  }

  /**
   * Fusiona y valida. `lostNames` son los `signalVariableName` que dejan de
   * existir tras el guardado (renombrados o quitados y no reutilizados).
   */
  private buildConfig(
    current: OpcUaConnectionConfig,
    input: SaveOpcUaVariablesInput,
  ): { config: OpcUaConnectionConfig; lostNames: string[] } {
    const { mapping, renamedFrom, removedNames } = mergeSyncedVariables(
      current.nodeMapping,
      input.variables,
      input.remove,
    );
    if (mapping.length > MAX_NODE_MAPPING_ENTRIES) {
      throw new OpcUaMappingLimitError(mapping.length, MAX_NODE_MAPPING_ENTRIES);
    }
    const parsed = parseOpcUaConnectionConfig({
      ...current,
      nodeMapping: mapping,
      variableSyncRootNodeId: input.rootNodeId,
    });
    if (!parsed.ok) {
      throw new InvalidConnectionConfigError(parsed.reason);
    }
    const remaining = new Set(mapping.map((entry) => entry.signalVariableName));
    const lostNames = [...new Set([...renamedFrom, ...removedNames])].filter(
      (name) => !remaining.has(name),
    );
    return { config: parsed.config, lostNames };
  }

  /**
   * spec 21, criterio backend 9: los nombres que dejan de existir tras el
   * guardado no pueden estar en uso por Signals activas (DIRECT o FORMULA) ni
   * por paquetes de escritura activos.
   */
  private async assertNotInUse(
    machineId: string,
    lostNames: readonly string[],
    ctx: TransactionContext,
  ): Promise<void> {
    if (lostNames.length === 0) {
      return;
    }

    const [signals, writePackages] = await Promise.all([
      this.signalRepository.findAllByMachineId(machineId, ctx),
      this.writePackageRepository.listActiveByMachine(machineId, ctx),
    ]);
    const inUse: VariableInUse[] = [];
    for (const name of lostNames) {
      const usedBy: VariableInUse['usedBy'] = [];
      for (const signal of signals) {
        if (!signal.isActive) continue;
        const source = signal.signalSource;
        const uses = isFormulaSignalSource(source)
          ? source.variables.includes(name)
          : source.variableName === name;
        if (uses) usedBy.push({ kind: 'Signal', id: signal.id, name: signal.name });
      }
      for (const writePackage of writePackages) {
        if (writePackage.items.some((item) => item.signalVariableName === name)) {
          usedBy.push({ kind: 'WritePackage', id: writePackage.id, name: writePackage.name });
        }
      }
      if (usedBy.length > 0) {
        inUse.push({ signalVariableName: name, usedBy });
      }
    }
    if (inUse.length > 0) {
      throw new OpcUaVariableInUseError(inUse);
    }
  }
}
