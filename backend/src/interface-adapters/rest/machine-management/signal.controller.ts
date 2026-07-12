import {
  Body,
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
import { RealtimeCacheEntry } from '../../../entities/realtime-cache';
import { Signal } from '../../../entities/signal.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { SignalValueNotAvailableError } from '../../../use-cases/dashboard/errors/signal-value-not-available.error';
import { CreateSignalUseCase } from '../../../use-cases/machine-management/create-signal.use-case';
import { DeleteSignalUseCase } from '../../../use-cases/machine-management/delete-signal.use-case';
import { FormulaReferencesUnknownVariableError } from '../../../use-cases/machine-management/errors/formula-references-unknown-variable.error';
import { MachineInactiveError } from '../../../use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { SignalNotFoundError } from '../../../use-cases/machine-management/errors/signal-not-found.error';
import { GetSignalUseCase } from '../../../use-cases/machine-management/get-signal.use-case';
import { GetSignalValueUseCase } from '../../../use-cases/machine-management/get-signal-value.use-case';
import {
  ListSignalsResult,
  ListSignalsUseCase,
} from '../../../use-cases/machine-management/list-signals.use-case';
import { UpdateSignalUseCase } from '../../../use-cases/machine-management/update-signal.use-case';
import { PaginationQueryDto } from '../shared/pagination-query.dto';
import { CreateSignalDto } from './create-signal.dto';
import { UpdateSignalDto } from './update-signal.dto';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/** docs/specs/06-gestion-machines-signals.md, docs/11-api-rest.md sección "Signal". */
@Controller('machines/:machineId/signals')
export class SignalController {
  constructor(
    private readonly createSignalUseCase: CreateSignalUseCase,
    private readonly listSignalsUseCase: ListSignalsUseCase,
    private readonly getSignalUseCase: GetSignalUseCase,
    private readonly updateSignalUseCase: UpdateSignalUseCase,
    private readonly deleteSignalUseCase: DeleteSignalUseCase,
    private readonly getSignalValueUseCase: GetSignalValueUseCase,
  ) {}

  @Post()
  async create(
    @Param('machineId') machineId: string,
    @Body() dto: CreateSignalDto,
    @currentUser() user: CurrentUser,
  ): Promise<Signal> {
    try {
      return await this.createSignalUseCase.execute({
        machineId,
        requester: { companyId: user.companyId, role: user.role },
        name: dto.name,
        signalType: dto.signalType,
        signalSource: dto.signalSource,
        unit: dto.unit,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get()
  async list(
    @Param('machineId') machineId: string,
    @Query() query: PaginationQueryDto,
    @currentUser() user: CurrentUser,
  ): Promise<ListSignalsResult> {
    try {
      return await this.listSignalsUseCase.execute({
        machineId,
        requester: { companyId: user.companyId, role: user.role },
        pagination: {
          limit: query.limit ?? DEFAULT_LIMIT,
          offset: query.offset ?? DEFAULT_OFFSET,
        },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get(':id')
  async get(
    @Param('machineId') machineId: string,
    @Param('id') id: string,
    @currentUser() user: CurrentUser,
  ): Promise<Signal> {
    try {
      return await this.getSignalUseCase.execute({
        machineId,
        signalId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Get(':id/value')
  async getValue(
    @Param('machineId') machineId: string,
    @Param('id') id: string,
    @currentUser() user: CurrentUser,
  ): Promise<RealtimeCacheEntry> {
    try {
      return await this.getSignalValueUseCase.execute({
        machineId,
        signalId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Patch(':id')
  async update(
    @Param('machineId') machineId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSignalDto,
    @currentUser() user: CurrentUser,
  ): Promise<Signal> {
    try {
      return await this.updateSignalUseCase.execute({
        machineId,
        signalId: id,
        requester: { companyId: user.companyId, role: user.role },
        changes: dto as never,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('machineId') machineId: string,
    @Param('id') id: string,
    @currentUser() user: CurrentUser,
  ): Promise<void> {
    try {
      await this.deleteSignalUseCase.execute({
        machineId,
        signalId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof MachineNotFoundError) {
      return new NotFoundException({ code: 'MACHINE_NOT_FOUND', message: error.message });
    }
    if (error instanceof SignalNotFoundError) {
      return new NotFoundException({ code: 'SIGNAL_NOT_FOUND', message: error.message });
    }
    if (error instanceof SignalValueNotAvailableError) {
      return new NotFoundException({ code: 'SIGNAL_VALUE_NOT_AVAILABLE', message: error.message });
    }
    if (error instanceof MachineInactiveError) {
      return new UnprocessableEntityException({
        code: 'MACHINE_INACTIVE',
        message: error.message,
      });
    }
    if (error instanceof FormulaReferencesUnknownVariableError) {
      return new UnprocessableEntityException({
        code: 'FORMULA_REFERENCES_UNKNOWN_VARIABLE',
        message: error.message,
        details: { variables: error.unknownVariables },
      });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
