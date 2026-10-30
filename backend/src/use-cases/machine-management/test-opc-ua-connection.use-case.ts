import { Inject, Injectable } from '@nestjs/common';
import { OPCUA_DEFAULT_TIMEOUT_MS } from '../../entities/connection-config.vo';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { MachineAccessResolver, Requester } from './machine-access.resolver';
import { OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';
import {
  type IOpcUaExplorer,
  OPCUA_EXPLORER,
  type OpcUaConnectionTestResult,
} from './ports/opc-ua-explorer.port';

export type TestOpcUaConnectionInput = {
  machineId: string;
  requester: Requester;
  endpointUrl: string;
};

/**
 * docs/specs/18-integracion-opc-ua.md, criterio backend 5: abre y cierra una
 * sesión OPC UA anónima efímera contra `endpointUrl`. Un endpoint inalcanzable
 * no es un error HTTP sino `{ reachable: false, reason }`.
 */
@Injectable()
export class TestOpcUaConnectionUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly endpointPolicy: OpcUaEndpointPolicy,
    @Inject(OPCUA_EXPLORER) private readonly explorer: IOpcUaExplorer,
  ) {}

  /**
   * @throws InvalidOpcUaEndpointUrlError / OpcUaEndpointNotAllowedError (política anti-SSRF).
   * @throws MachineNotFoundError si la Machine no existe, está inactiva o es de otra Company.
   */
  async execute(input: TestOpcUaConnectionInput): Promise<OpcUaConnectionTestResult> {
    this.endpointPolicy.assertAllowed(input.endpointUrl);
    await this.unitOfWork.runInTransaction((ctx) =>
      this.resolver.resolveActive(input.machineId, input.requester, ctx),
    );
    return this.explorer.testConnection(input.endpointUrl, OPCUA_DEFAULT_TIMEOUT_MS);
  }
}
