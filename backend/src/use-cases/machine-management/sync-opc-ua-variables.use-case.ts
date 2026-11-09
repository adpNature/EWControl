import { Inject, Injectable } from '@nestjs/common';
import {
  isOpcUaConnectionConfig,
  MAX_NODE_ID_LENGTH,
  type OpcUaConnectionConfig,
} from '../../entities/connection-config.vo';
import {
  diffSyncedVariables,
  type RemovedVariable,
  type SkippedOpcUaVariable,
  summarizeSync,
  type SyncedVariable,
  type SyncSummary,
} from '../../entities/opc-ua-variable-sync';
import { ProviderType } from '../../entities/provider-type.enum';
import { CLOCK, type IClock } from '../history/ports/clock.port';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import type { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { MachineNotOpcUaError } from './errors/machine-not-opc-ua.error';
import { OpcUaInvalidNodeIdError } from './errors/opc-ua-invalid-node-id.error';
import { MachineAccessResolver, Requester } from './machine-access.resolver';
import { OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';
import {
  type IOpcUaExplorer,
  OPCUA_EXPLORER,
  type OpcUaScanLimits,
} from './ports/opc-ua-explorer.port';

/** spec 21, criterio backend 7 (OWASP A04): cota de cada sincronización. */
export const OPCUA_SYNC_LIMITS: OpcUaScanLimits = {
  timeoutMs: 60000,
  maxVariables: 2000,
  maxDepth: 8,
};

export type SyncOpcUaVariablesInput = {
  machineId: string;
  requester: Requester;
  rootNodeId: string;
};

/** Respuesta de `POST .../connection/opcua/variables/sync` (spec 21). */
export type OpcUaVariableSyncResult = {
  rootNodeId: string;
  syncedAt: string;
  summary: SyncSummary;
  variables: SyncedVariable[];
  removed: RemovedVariable[];
  skipped: SkippedOpcUaVariable[];
};

/**
 * Valida un `rootNodeId` recibido del exterior: texto no vacío y acotado. La
 * forma la comprueba después el explorador al resolverlo (OWASP A03).
 * @throws OpcUaInvalidNodeIdError
 */
export function assertValidRootNodeId(rootNodeId: string): void {
  if (rootNodeId.trim().length === 0 || rootNodeId.length > MAX_NODE_ID_LENGTH) {
    throw new OpcUaInvalidNodeIdError(rootNodeId.slice(0, 80));
  }
}

/**
 * Devuelve la conexión OPC UA de una Machine accesible para el requester.
 * @throws MachineNotFoundError / MachineNotOpcUaError
 */
export async function resolveOpcUaConnection(
  resolver: MachineAccessResolver,
  connectionRepository: IMachineConnectionRepository,
  machineId: string,
  requester: Requester,
  ctx: TransactionContext,
): Promise<{ companyId: string; config: OpcUaConnectionConfig }> {
  const machine = await resolver.resolveActive(machineId, requester, ctx);
  const connection = await connectionRepository.findByMachineId(machine.id, ctx);
  if (
    !connection ||
    connection.providerType !== ProviderType.OpcUa ||
    !isOpcUaConnectionConfig(connection.connectionConfig)
  ) {
    throw new MachineNotOpcUaError(machine.id);
  }
  return { companyId: machine.companyId, config: connection.connectionConfig };
}

/**
 * docs/specs/21-sincronizacion-variables-opc-ua.md: lee todas las variables de
 * una carpeta del servidor OPC UA de la Machine y las compara con su
 * `nodeMapping`. Solo lectura: no escribe ni en el PLC ni en la base de datos.
 */
@Injectable()
export class SyncOpcUaVariablesUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly connectionRepository: IMachineConnectionRepository,
    private readonly endpointPolicy: OpcUaEndpointPolicy,
    @Inject(OPCUA_EXPLORER) private readonly explorer: IOpcUaExplorer,
    @Inject(CLOCK) private readonly clock: IClock,
  ) {}

  /**
   * @throws OpcUaInvalidNodeIdError si `rootNodeId` está vacío, es demasiado largo o no existe.
   * @throws MachineNotFoundError / MachineNotOpcUaError.
   * @throws OpcUaEndpointNotAllowedError si el endpoint guardado ya no está permitido (OWASP A10).
   * @throws OpcUaEndpointUnreachableError / OpcUaSyncTimeoutError / OpcUaSyncTooManyNodesError (desde el explorador).
   */
  async execute(input: SyncOpcUaVariablesInput): Promise<OpcUaVariableSyncResult> {
    assertValidRootNodeId(input.rootNodeId);
    const { config } = await this.unitOfWork.runInTransaction((ctx) =>
      resolveOpcUaConnection(
        this.resolver,
        this.connectionRepository,
        input.machineId,
        input.requester,
        ctx,
      ),
    );
    this.endpointPolicy.assertAllowed(config.endpointUrl);

    const scan = await this.explorer.scanVariables(
      config.endpointUrl,
      input.rootNodeId,
      config.nodeMapping.map((entry) => entry.nodeId),
      OPCUA_SYNC_LIMITS,
    );
    const { variables, removed } = diffSyncedVariables(
      scan.variables,
      config.nodeMapping,
      scan.existence,
    );
    return {
      rootNodeId: input.rootNodeId,
      syncedAt: this.clock.now().toISOString(),
      summary: summarizeSync(variables, removed, scan.skipped),
      variables,
      removed,
      skipped: scan.skipped,
    };
  }
}
