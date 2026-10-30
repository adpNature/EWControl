import { Inject, Injectable } from '@nestjs/common';
import {
  type ConnectionConfig,
  parseOpcUaConnectionConfig,
  type SimulatorConnectionConfig,
} from '../../entities/connection-config.vo';
import { MachineConnection } from '../../entities/machine-connection.entity';
import { ProviderType } from '../../entities/provider-type.enum';
import {
  type IMachineConnectionRepository,
  MACHINE_CONNECTION_REPOSITORY,
} from '../seed-demo-environment/ports/machine-connection-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  EVENT_PUBLISHER,
  type IEventPublisher,
} from '../simulator-control/ports/event-publisher.port';
import { InvalidConnectionConfigError } from './errors/invalid-connection-config.error';
import { ProviderNotSupportedError } from './errors/provider-not-supported.error';
import { assertMachineActive, MachineAccessResolver, Requester } from './machine-access.resolver';
import { OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';

export type ReplaceMachineConnectionInput = {
  machineId: string;
  requester: Requester;
  providerType: ProviderType;
  /** Sin tipar: llega del exterior y se valida aquí según `providerType`. */
  connectionConfig: unknown;
};

/**
 * docs/specs/06-gestion-machines-signals.md (criterio backend 4) y
 * docs/specs/18-integracion-opc-ua.md (criterios backend 1-4): admite
 * `Simulator` y `OpcUa`; cualquier otro `ProviderType` es 422. Tras el commit
 * publica `MachineConnectionReplaced` para que los registries de Data Providers
 * cambien el provider en caliente (criterio 2).
 */
@Injectable()
export class ReplaceMachineConnectionUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(MACHINE_CONNECTION_REPOSITORY)
    private readonly machineConnectionRepository: IMachineConnectionRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    private readonly endpointPolicy: OpcUaEndpointPolicy,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: IEventPublisher,
  ) {}

  /**
   * @throws ProviderNotSupportedError si `providerType` no es Simulator ni OpcUa.
   * @throws InvalidConnectionConfigError si la config OpcUa no es válida.
   * @throws InvalidOpcUaEndpointUrlError / OpcUaEndpointNotAllowedError (política anti-SSRF).
   */
  async execute(input: ReplaceMachineConnectionInput): Promise<MachineConnection> {
    const connectionConfig = this.validateConnectionConfig(
      input.providerType,
      input.connectionConfig,
    );

    const { connection, previousProviderType, companyId } = await this.unitOfWork.runInTransaction(
      async (ctx) => {
        const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
        assertMachineActive(machine);
        const previous = await this.machineConnectionRepository.findByMachineId(machine.id, ctx);
        const replaced = await this.machineConnectionRepository.replace(
          machine.id,
          { providerType: input.providerType, connectionConfig },
          ctx,
        );
        return {
          connection: replaced,
          previousProviderType: previous?.providerType ?? null,
          companyId: machine.companyId,
        };
      },
    );

    this.eventPublisher.publish('MachineConnectionReplaced', {
      machineId: connection.machineId,
      companyId,
      previousProviderType,
      providerType: connection.providerType,
    });
    return connection;
  }

  private validateConnectionConfig(providerType: ProviderType, raw: unknown): ConnectionConfig {
    switch (providerType) {
      case ProviderType.Simulator:
        return raw as SimulatorConnectionConfig;
      case ProviderType.OpcUa: {
        const parsed = parseOpcUaConnectionConfig(raw);
        if (!parsed.ok) {
          throw new InvalidConnectionConfigError(parsed.reason);
        }
        this.endpointPolicy.assertAllowed(parsed.config.endpointUrl);
        return parsed.config;
      }
      default:
        throw new ProviderNotSupportedError(providerType);
    }
  }
}
