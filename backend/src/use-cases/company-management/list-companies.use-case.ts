import { Inject, Injectable } from '@nestjs/common';
import { Company } from '../../entities/company.entity';
import {
  type ICompanyRepository,
  COMPANY_REPOSITORY,
} from '../seed-demo-environment/ports/company-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';

export type ListCompaniesInput = { pagination: { limit: number; offset: number } };
export type ListCompaniesResult = {
  data: Company[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: lista
 * todas las Companies (solo accesible por SuperAdmin, sin filtrado por Company
 * — Company es la propia raíz del aislamiento multiempresa).
 */
@Injectable()
export class ListCompaniesUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: ICompanyRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: ListCompaniesInput): Promise<ListCompaniesResult> {
    const { data, total } = await this.unitOfWork.runInTransaction((ctx) =>
      this.companyRepository.list(input.pagination, ctx),
    );
    return { data, total, limit: input.pagination.limit, offset: input.pagination.offset };
  }
}
