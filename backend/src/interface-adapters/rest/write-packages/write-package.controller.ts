import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CONFIGURATION_ROLES, roles } from '../../auth-guard/roles.decorator';
import type { WritePackageExecution } from '../../../entities/write-package-execution.entity';
import type { WritePackage } from '../../../entities/write-package.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { ProviderNotSupportedError } from '../../../use-cases/machine-management/errors/provider-not-supported.error';
import { InvalidWritePackageError } from '../../../use-cases/write-packages/errors/invalid-write-package.error';
import { MachineNotConnectedError } from '../../../use-cases/write-packages/errors/machine-not-connected.error';
import { WriteInProgressError } from '../../../use-cases/write-packages/errors/write-in-progress.error';
import { WritePackageNameTakenError } from '../../../use-cases/write-packages/errors/write-package-name-taken.error';
import { WritePackageNotFoundError } from '../../../use-cases/write-packages/errors/write-package-not-found.error';
import { WritePackageOutdatedError } from '../../../use-cases/write-packages/errors/write-package-outdated.error';
import { ExecuteWritePackageUseCase } from '../../../use-cases/write-packages/execute-write-package.use-case';
import {
  CreateWritePackageUseCase,
  DeactivateWritePackageUseCase,
  GetWritePackageUseCase,
  ListWritePackageExecutionsUseCase,
  ListWritePackagesUseCase,
  UpdateWritePackageUseCase,
  type WritePackageList,
} from '../../../use-cases/write-packages/write-package-management.use-cases';
import { PaginationQueryDto } from '../shared/pagination-query.dto';
import { CreateWritePackageDto, UpdateWritePackageDto } from './write-package.dto';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/**
 * docs/specs/20-paquetes-escritura-opc-ua.md, sección "Contrato": gestión de
 * paquetes solo para `AdminCliente`/`SuperAdmin`; listar, consultar, ejecutar y
 * ver el historial, para los tres roles (también el `Operador`, spec 19).
 */
@Controller('machines/:machineId/write-packages')
export class WritePackageController {
  constructor(
    private readonly listWritePackages: ListWritePackagesUseCase,
    private readonly getWritePackage: GetWritePackageUseCase,
    private readonly createWritePackage: CreateWritePackageUseCase,
    private readonly updateWritePackage: UpdateWritePackageUseCase,
    private readonly deactivateWritePackage: DeactivateWritePackageUseCase,
    private readonly executeWritePackage: ExecuteWritePackageUseCase,
    private readonly listExecutions: ListWritePackageExecutionsUseCase,
  ) {}

  @Get()
  list(
    @Param('machineId') machineId: string,
    @currentUser() user: CurrentUser,
  ): Promise<WritePackageList> {
    return this.run(() =>
      this.listWritePackages.execute({ machineId, requester: requesterOf(user) }),
    );
  }

  @Get(':id')
  get(
    @Param('machineId') machineId: string,
    @Param('id') packageId: string,
    @currentUser() user: CurrentUser,
  ): Promise<WritePackage> {
    return this.run(() =>
      this.getWritePackage.execute({ machineId, packageId, requester: requesterOf(user) }),
    );
  }

  @roles(...CONFIGURATION_ROLES)
  @Post()
  create(
    @Param('machineId') machineId: string,
    @Body() dto: CreateWritePackageDto,
    @currentUser() user: CurrentUser,
  ): Promise<WritePackage> {
    return this.run(() =>
      this.createWritePackage.execute({
        machineId,
        requester: requesterOf(user),
        name: dto.name,
        description: dto.description ?? null,
        items: dto.items.map(({ signalVariableName, value }) => ({ signalVariableName, value })),
      }),
    );
  }

  @roles(...CONFIGURATION_ROLES)
  @Patch(':id')
  update(
    @Param('machineId') machineId: string,
    @Param('id') packageId: string,
    @Body() dto: UpdateWritePackageDto,
    @currentUser() user: CurrentUser,
  ): Promise<WritePackage> {
    return this.run(() =>
      this.updateWritePackage.execute({
        machineId,
        packageId,
        requester: requesterOf(user),
        changes: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.items
            ? {
                items: dto.items.map(({ signalVariableName, value }) => ({
                  signalVariableName,
                  value,
                })),
              }
            : {}),
        },
      }),
    );
  }

  @roles(...CONFIGURATION_ROLES)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('machineId') machineId: string,
    @Param('id') packageId: string,
    @currentUser() user: CurrentUser,
  ): Promise<void> {
    return this.run(() =>
      this.deactivateWritePackage.execute({ machineId, packageId, requester: requesterOf(user) }),
    );
  }

  /**
   * spec 20, criterios backend 4-8. Cuerpo vacío a propósito: nunca se acepta
   * un `nodeId` ni un valor libre, todo sale del paquete guardado (OWASP A04).
   */
  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  execute(
    @Param('machineId') machineId: string,
    @Param('id') packageId: string,
    @currentUser() user: CurrentUser,
  ): Promise<WritePackageExecution> {
    return this.run(() =>
      this.executeWritePackage.execute({
        machineId,
        packageId,
        requester: requesterOf(user),
        executedBy: { userId: user.id, email: user.email },
      }),
    );
  }

  @Get(':id/executions')
  executions(
    @Param('machineId') machineId: string,
    @Param('id') packageId: string,
    @Query() query: PaginationQueryDto,
    @currentUser() user: CurrentUser,
  ): Promise<{ data: WritePackageExecution[]; total: number; limit: number; offset: number }> {
    return this.run(() =>
      this.listExecutions.execute({
        machineId,
        packageId,
        requester: requesterOf(user),
        pagination: { limit: query.limit ?? DEFAULT_LIMIT, offset: query.offset ?? DEFAULT_OFFSET },
      }),
    );
  }

  private async run<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function requesterOf(user: CurrentUser) {
  return { companyId: user.companyId, role: user.role };
}

function toHttpException(error: unknown): HttpException {
  if (error instanceof MachineNotFoundError) {
    return new NotFoundException({ code: 'MACHINE_NOT_FOUND', message: error.message });
  }
  if (error instanceof WritePackageNotFoundError) {
    return new NotFoundException({ code: 'WRITE_PACKAGE_NOT_FOUND', message: error.message });
  }
  if (error instanceof InvalidWritePackageError) {
    return new BadRequestException({
      code: 'INVALID_WRITE_PACKAGE',
      message: error.message,
      details: { index: error.index, reason: error.reason },
    });
  }
  if (error instanceof WritePackageNameTakenError) {
    return new ConflictException({ code: 'WRITE_PACKAGE_NAME_TAKEN', message: error.message });
  }
  if (error instanceof WritePackageOutdatedError) {
    return new ConflictException({ code: 'WRITE_PACKAGE_OUTDATED', message: error.message });
  }
  if (error instanceof MachineNotConnectedError) {
    return new ConflictException({ code: 'MACHINE_NOT_CONNECTED', message: error.message });
  }
  if (error instanceof WriteInProgressError) {
    return new ConflictException({ code: 'WRITE_IN_PROGRESS', message: error.message });
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
