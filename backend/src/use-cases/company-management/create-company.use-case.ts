import { Inject, Injectable } from '@nestjs/common';
import { Company } from '../../entities/company.entity';
import {
  type ICompanyRepository,
  COMPANY_REPOSITORY,
} from '../seed-demo-environment/ports/company-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';

export type CreateCompanyInput = { name: string };

/** docs/specs/10-gestion-companies-users.md, flujo principal backend: alta de una Company (solo SuperAdmin). */
@Injectable()
export class CreateCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: ICompanyRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: CreateCompanyInput): Promise<Company> {
    return this.unitOfWork.runInTransaction((ctx) =>
      this.companyRepository.create({ name: input.name }, ctx),
    );
  }
}
