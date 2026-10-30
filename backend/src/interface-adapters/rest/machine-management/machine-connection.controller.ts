import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CONFIGURATION_ROLES, roles } from '../../auth-guard/roles.decorator';
import { MachineConnection } from '../../../entities/machine-connection.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { BrowseOpcUaNodesUseCase } from '../../../use-cases/machine-management/browse-opc-ua-nodes.use-case';
import { InvalidConnectionConfigError } from '../../../use-cases/machine-management/errors/invalid-connection-config.error';
import { InvalidOpcUaEndpointUrlError } from '../../../use-cases/machine-management/errors/invalid-opc-ua-endpoint-url.error';
import { MachineInactiveError } from '../../../use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { OpcUaEndpointNotAllowedError } from '../../../use-cases/machine-management/errors/opc-ua-endpoint-not-allowed.error';
import { OpcUaEndpointUnreachableError } from '../../../use-cases/machine-management/errors/opc-ua-endpoint-unreachable.error';
import { OpcUaInvalidNodeIdError } from '../../../use-cases/machine-management/errors/opc-ua-invalid-node-id.error';
import { ProviderNotSupportedError } from '../../../use-cases/machine-management/errors/provider-not-supported.error';
import { GetMachineConnectionUseCase } from '../../../use-cases/machine-management/get-machine-connection.use-case';
import type {
  OpcUaBrowseNode,
  OpcUaConnectionTestResult,
} from '../../../use-cases/machine-management/ports/opc-ua-explorer.port';
import { ReplaceMachineConnectionUseCase } from '../../../use-cases/machine-management/replace-machine-connection.use-case';
import { TestOpcUaConnectionUseCase } from '../../../use-cases/machine-management/test-opc-ua-connection.use-case';
import { BrowseOpcUaNodesDto, TestOpcUaConnectionDto } from './opc-ua-explorer.dto';
import { ReplaceMachineConnectionDto } from './replace-machine-connection.dto';

/**
 * docs/specs/06-gestion-machines-signals.md, docs/specs/18-integracion-opc-ua.md,
 * docs/11-api-rest.md sección "MachineConnection". Se gestiona siempre en el
 * contexto de su Machine.
 */
@roles(...CONFIGURATION_ROLES)
@Controller('machines/:machineId/connection')
export class MachineConnectionController {
  constructor(
    private readonly getMachineConnectionUseCase: GetMachineConnectionUseCase,
    private readonly replaceMachineConnectionUseCase: ReplaceMachineConnectionUseCase,
    private readonly testOpcUaConnectionUseCase: TestOpcUaConnectionUseCase,
    private readonly browseOpcUaNodesUseCase: BrowseOpcUaNodesUseCase,
  ) {}

  @Get()
  async get(
    @Param('machineId') machineId: string,
    @currentUser() user: CurrentUser,
  ): Promise<MachineConnection | null> {
    try {
      return await this.getMachineConnectionUseCase.execute({
        machineId,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Put()
  async replace(
    @Param('machineId') machineId: string,
    @Body() dto: ReplaceMachineConnectionDto,
    @currentUser() user: CurrentUser,
  ): Promise<MachineConnection> {
    try {
      return await this.replaceMachineConnectionUseCase.execute({
        machineId,
        requester: { companyId: user.companyId, role: user.role },
        providerType: dto.providerType,
        connectionConfig: dto.connectionConfig,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /** spec 18, criterio backend 5: un endpoint inalcanzable es `200 { reachable: false }`. */
  @Post('opcua/test')
  @HttpCode(HttpStatus.OK)
  async testOpcUa(
    @Param('machineId') machineId: string,
    @Body() dto: TestOpcUaConnectionDto,
    @currentUser() user: CurrentUser,
  ): Promise<OpcUaConnectionTestResult> {
    try {
      return await this.testOpcUaConnectionUseCase.execute({
        machineId,
        requester: { companyId: user.companyId, role: user.role },
        endpointUrl: dto.endpointUrl,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  /** spec 18, criterio backend 6. `POST` para que el endpoint no viaje en la URL ni en los logs de acceso. */
  @Post('opcua/browse')
  @HttpCode(HttpStatus.OK)
  async browseOpcUa(
    @Param('machineId') machineId: string,
    @Body() dto: BrowseOpcUaNodesDto,
    @currentUser() user: CurrentUser,
  ): Promise<{ nodes: OpcUaBrowseNode[] }> {
    try {
      return await this.browseOpcUaNodesUseCase.execute({
        machineId,
        requester: { companyId: user.companyId, role: user.role },
        endpointUrl: dto.endpointUrl,
        nodeId: dto.nodeId,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof MachineNotFoundError) {
      return new NotFoundException({ code: 'MACHINE_NOT_FOUND', message: error.message });
    }
    if (error instanceof MachineInactiveError) {
      return new UnprocessableEntityException({
        code: 'MACHINE_INACTIVE',
        message: error.message,
      });
    }
    if (error instanceof ProviderNotSupportedError) {
      return new UnprocessableEntityException({
        code: 'PROVIDER_NOT_SUPPORTED',
        message: error.message,
      });
    }
    if (error instanceof InvalidConnectionConfigError) {
      return new BadRequestException({ code: 'INVALID_CONNECTION_CONFIG', message: error.message });
    }
    if (error instanceof InvalidOpcUaEndpointUrlError) {
      return new BadRequestException({ code: 'INVALID_ENDPOINT_URL', message: error.message });
    }
    if (error instanceof OpcUaInvalidNodeIdError) {
      return new BadRequestException({ code: 'OPCUA_INVALID_NODE_ID', message: error.message });
    }
    if (error instanceof OpcUaEndpointNotAllowedError) {
      return new UnprocessableEntityException({
        code: 'OPCUA_ENDPOINT_NOT_ALLOWED',
        message: error.message,
      });
    }
    if (error instanceof OpcUaEndpointUnreachableError) {
      return new BadGatewayException({
        code: 'OPCUA_ENDPOINT_UNREACHABLE',
        message: error.message,
      });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
