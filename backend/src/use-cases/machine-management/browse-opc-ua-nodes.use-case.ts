import { Inject, Injectable } from '@nestjs/common';
import { OPCUA_DEFAULT_TIMEOUT_MS } from '../../entities/connection-config.vo';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { MachineAccessResolver, Requester } from './machine-access.resolver';
import { OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';
import {
  type IOpcUaExplorer,
  OPCUA_EXPLORER,
  type OpcUaBrowseNode,
} from './ports/opc-ua-explorer.port';

export type BrowseOpcUaNodesInput = {
  machineId: string;
  requester: Requester;
  endpointUrl: string;
  /** Sin `nodeId` se exploran los hijos de `ObjectsFolder` (`i=85`). */
  nodeId?: string;
};

/**
 * docs/specs/18-integracion-opc-ua.md, criterio backend 6: devuelve los hijos
 * directos de un nodo del servidor OPC UA, para descubrir los NodeIds desde la
 * UI (exploración por niveles, bajo demanda).
 */
@Injectable()
export class BrowseOpcUaNodesUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly endpointPolicy: OpcUaEndpointPolicy,
    @Inject(OPCUA_EXPLORER) private readonly explorer: IOpcUaExplorer,
  ) {}

  /**
   * @throws InvalidOpcUaEndpointUrlError / OpcUaEndpointNotAllowedError (política anti-SSRF).
   * @throws MachineNotFoundError si la Machine no existe, está inactiva o es de otra Company.
   * @throws OpcUaEndpointUnreachableError / OpcUaInvalidNodeIdError (desde el explorador).
   */
  async execute(input: BrowseOpcUaNodesInput): Promise<{ nodes: OpcUaBrowseNode[] }> {
    this.endpointPolicy.assertAllowed(input.endpointUrl);
    await this.unitOfWork.runInTransaction((ctx) =>
      this.resolver.resolveActive(input.machineId, input.requester, ctx),
    );
    const nodes = await this.explorer.browse(
      input.endpointUrl,
      input.nodeId,
      OPCUA_DEFAULT_TIMEOUT_MS,
    );
    return { nodes };
  }
}
