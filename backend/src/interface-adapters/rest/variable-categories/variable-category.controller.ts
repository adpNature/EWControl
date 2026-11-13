import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { VariableCategory } from '../../../entities/variable-category.entity';
import { MachineInactiveError } from '../../../use-cases/machine-management/errors/machine-inactive.error';
import { MachineNotFoundError } from '../../../use-cases/machine-management/errors/machine-not-found.error';
import { InvalidGvlExportError } from '../../../use-cases/variable-categories/errors/invalid-gvl-export.error';
import { InvalidVariableCategoryNameError } from '../../../use-cases/variable-categories/errors/invalid-variable-category-name.error';
import { VariableCategoryNameTakenError } from '../../../use-cases/variable-categories/errors/variable-category-name-taken.error';
import { VariableCategoryNotFoundError } from '../../../use-cases/variable-categories/errors/variable-category-not-found.error';
import {
  ImportVariableCategoriesUseCase,
  type ImportVariableCategoriesSummary,
  ListVariableCategoriesUseCase,
  RenameVariableCategoryUseCase,
  type VariableCategoryList,
} from '../../../use-cases/variable-categories/variable-categories.use-cases';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { CONFIGURATION_ROLES, roles } from '../../auth-guard/roles.decorator';
import { ImportVariableCategoriesDto, RenameVariableCategoryDto } from './variable-category.dto';

/**
 * docs/specs/23-categorias-variables-plc.md: categorías de variables del PLC de
 * una Machine. Solo `AdminCliente`/`SuperAdmin` (criterio backend 8).
 */
@Controller('machines/:machineId/variable-categories')
export class VariableCategoryController {
  constructor(
    private readonly listCategories: ListVariableCategoriesUseCase,
    private readonly importCategories: ImportVariableCategoriesUseCase,
    private readonly renameCategory: RenameVariableCategoryUseCase,
  ) {}

  @roles(...CONFIGURATION_ROLES)
  @Get()
  list(
    @Param('machineId') machineId: string,
    @currentUser() user: CurrentUser,
  ): Promise<VariableCategoryList> {
    return run(() => this.listCategories.execute({ machineId, requester: requesterOf(user) }));
  }

  @roles(...CONFIGURATION_ROLES)
  @Post('import')
  @HttpCode(HttpStatus.OK)
  import(
    @Param('machineId') machineId: string,
    @Body() dto: ImportVariableCategoriesDto,
    @currentUser() user: CurrentUser,
  ): Promise<ImportVariableCategoriesSummary> {
    return run(() =>
      this.importCategories.execute({
        machineId,
        requester: requesterOf(user),
        rootNodeId: dto.rootNodeId,
        csv: dto.csv,
      }),
    );
  }

  @roles(...CONFIGURATION_ROLES)
  @Patch(':id')
  rename(
    @Param('machineId') machineId: string,
    @Param('id') categoryId: string,
    @Body() dto: RenameVariableCategoryDto,
    @currentUser() user: CurrentUser,
  ): Promise<VariableCategory> {
    return run(() =>
      this.renameCategory.execute({
        machineId,
        categoryId,
        requester: requesterOf(user),
        name: dto.name,
      }),
    );
  }
}

function requesterOf(user: CurrentUser) {
  return { companyId: user.companyId, role: user.role };
}

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toHttpException(error);
  }
}

function toHttpException(error: unknown): HttpException {
  if (error instanceof MachineNotFoundError) {
    return new NotFoundException({ code: 'MACHINE_NOT_FOUND', message: error.message });
  }
  if (error instanceof MachineInactiveError) {
    return new UnprocessableEntityException({ code: 'MACHINE_INACTIVE', message: error.message });
  }
  if (error instanceof VariableCategoryNotFoundError) {
    return new NotFoundException({ code: 'VARIABLE_CATEGORY_NOT_FOUND', message: error.message });
  }
  if (error instanceof InvalidGvlExportError) {
    return new BadRequestException({
      code: 'INVALID_GVL_EXPORT',
      message: error.message,
      details: { reason: error.reason },
    });
  }
  if (error instanceof InvalidVariableCategoryNameError) {
    return new BadRequestException({
      code: 'INVALID_VARIABLE_CATEGORY_NAME',
      message: error.message,
      details: { maxLength: error.maxLength },
    });
  }
  if (error instanceof VariableCategoryNameTakenError) {
    return new ConflictException({ code: 'VARIABLE_CATEGORY_NAME_TAKEN', message: error.message });
  }
  if (error instanceof HttpException) {
    return error;
  }
  return new InternalServerErrorException();
}
