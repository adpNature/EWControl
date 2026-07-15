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
} from '@nestjs/common';
import { Company } from '../../../entities/company.entity';
import { UserRole } from '../../../entities/user-role.enum';
import { CreateCompanyUseCase } from '../../../use-cases/company-management/create-company.use-case';
import { DeactivateCompanyUseCase } from '../../../use-cases/company-management/deactivate-company.use-case';
import { DeleteCompanyPermanentlyUseCase } from '../../../use-cases/company-management/delete-company-permanently.use-case';
import { CompanyNotFoundError } from '../../../use-cases/company-management/errors/company-not-found.error';
import { GetCompanyUseCase } from '../../../use-cases/company-management/get-company.use-case';
import {
  ListCompaniesResult,
  ListCompaniesUseCase,
} from '../../../use-cases/company-management/list-companies.use-case';
import { ReactivateCompanyUseCase } from '../../../use-cases/company-management/reactivate-company.use-case';
import { UpdateCompanyUseCase } from '../../../use-cases/company-management/update-company.use-case';
import { roles } from '../../auth-guard/roles.decorator';
import { PaginationQueryDto } from '../shared/pagination-query.dto';
import { CreateCompanyDto } from './create-company.dto';
import { UpdateCompanyDto } from './update-company.dto';

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;

/**
 * docs/specs/10-gestion-companies-users.md, docs/11-api-rest.md sección "Company".
 * Solo `SuperAdmin` (`@roles`, `RolesGuard` registrado globalmente en `auth.module.ts`).
 */
@Controller('companies')
@roles(UserRole.SuperAdmin)
export class CompanyController {
  constructor(
    private readonly createCompanyUseCase: CreateCompanyUseCase,
    private readonly listCompaniesUseCase: ListCompaniesUseCase,
    private readonly getCompanyUseCase: GetCompanyUseCase,
    private readonly updateCompanyUseCase: UpdateCompanyUseCase,
    private readonly deactivateCompanyUseCase: DeactivateCompanyUseCase,
    private readonly reactivateCompanyUseCase: ReactivateCompanyUseCase,
    private readonly deleteCompanyPermanentlyUseCase: DeleteCompanyPermanentlyUseCase,
  ) {}

  @Post()
  create(@Body() dto: CreateCompanyDto): Promise<Company> {
    return this.createCompanyUseCase.execute({ name: dto.name });
  }

  @Get()
  list(@Query() query: PaginationQueryDto): Promise<ListCompaniesResult> {
    return this.listCompaniesUseCase.execute({
      pagination: { limit: query.limit ?? DEFAULT_LIMIT, offset: query.offset ?? DEFAULT_OFFSET },
    });
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<Company> {
    try {
      return await this.getCompanyUseCase.execute({ companyId: id });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto): Promise<Company> {
    try {
      return await this.updateCompanyUseCase.execute({ companyId: id, name: dto.name });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    try {
      await this.deactivateCompanyUseCase.execute({ companyId: id });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Param('id') id: string): Promise<Company> {
    try {
      return await this.reactivateCompanyUseCase.execute({ companyId: id });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @Delete(':id/purge')
  @HttpCode(HttpStatus.NO_CONTENT)
  async purge(@Param('id') id: string): Promise<void> {
    try {
      await this.deleteCompanyPermanentlyUseCase.execute({ companyId: id });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof CompanyNotFoundError) {
      return new NotFoundException({ code: 'COMPANY_NOT_FOUND', message: error.message });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
