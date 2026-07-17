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
import { Machine } from '../../../entities/machine.entity';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { CreateMachineUseCase } from '../../../use-cases/machine-management/create-machine.use-case';
import { DeleteMachineUseCase } from '../../../use-cases/machine-management/delete-machine.use-case';
import { MachineInactiveError } from '../../../use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { GetMachineUseCase } from '../../../use-cases/machine-management/get-machine.use-case';
import {
  ListMachinesResult,
  ListMachinesUseCase,
} from '../../../use-cases/machine-management/list-machines.use-case';
import { UpdateMachineUseCase } from '../../../use-cases/machine-management/update-machine.use-case';
import { CreateMachineDto } from './create-machine.dto';
import { ListMachinesQueryDto } from './list-machines-query.dto';
import { UpdateMachineDto } from './update-machine.dto';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/** docs/specs/06-gestion-machines-signals.md, docs/11-api-rest.md sección "Machine". */
@Controller('machines')
export class MachineController {
  constructor(
    private readonly createMachineUseCase: CreateMachineUseCase,
    private readonly listMachinesUseCase: ListMachinesUseCase,
    private readonly getMachineUseCase: GetMachineUseCase,
    private readonly updateMachineUseCase: UpdateMachineUseCase,
    private readonly deleteMachineUseCase: DeleteMachineUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateMachineDto, @currentUser() user: CurrentUser): Promise<Machine> {
    const { machine } = await this.createMachineUseCase.execute({
      companyId: user.companyId,
      name: dto.name,
    });
    return machine;
  }

  @Get()
  list(
    @Query() query: ListMachinesQueryDto,
    @currentUser() user: CurrentUser,
  ): Promise<ListMachinesResult> {
    return this.listMachinesUseCase.execute({
      requester: { companyId: user.companyId, role: user.role },
      companyId: query.companyId,
      pagination: { limit: query.limit ?? DEFAULT_LIMIT, offset: query.offset ?? DEFAULT_OFFSET },
    });
  }

  @Get(':id')
  async get(@Param('id') id: string, @currentUser() user: CurrentUser): Promise<Machine> {
    try {
      return await this.getMachineUseCase.execute({
        machineId: id,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateMachineDto,
    @currentUser() user: CurrentUser,
  ): Promise<Machine> {
    try {
      return await this.updateMachineUseCase.execute({
        machineId: id,
        requester: { companyId: user.companyId, role: user.role },
        name: dto.name,
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @currentUser() user: CurrentUser): Promise<void> {
    try {
      await this.deleteMachineUseCase.execute({
        machineId: id,
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
    if (error instanceof MachineInactiveError) {
      return new UnprocessableEntityException({
        code: 'MACHINE_INACTIVE',
        message: error.message,
      });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
