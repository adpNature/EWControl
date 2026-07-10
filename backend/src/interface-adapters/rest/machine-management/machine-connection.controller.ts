import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MachineConnection } from '../../../entities/machine-connection.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { MachineInactiveError } from '../../../use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { ProviderNotSupportedError } from '../../../use-cases/machine-management/errors/provider-not-supported.error';
import { GetMachineConnectionUseCase } from '../../../use-cases/machine-management/get-machine-connection.use-case';
import { ReplaceMachineConnectionUseCase } from '../../../use-cases/machine-management/replace-machine-connection.use-case';
import { ReplaceMachineConnectionDto } from './replace-machine-connection.dto';

/**
 * docs/specs/06-gestion-machines-signals.md, docs/11-api-rest.md sección
 * "MachineConnection". Se gestiona siempre en el contexto de su Machine.
 */
@Controller('machines/:machineId/connection')
export class MachineConnectionController {
  constructor(
    private readonly getMachineConnectionUseCase: GetMachineConnectionUseCase,
    private readonly replaceMachineConnectionUseCase: ReplaceMachineConnectionUseCase,
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
        connectionConfig: dto.connectionConfig as never,
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
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
