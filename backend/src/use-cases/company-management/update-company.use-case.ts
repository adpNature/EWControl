import { Inject, Injectable } from '@nestjs/common';
import { Company } from '../../entities/company.entity';
import {
  type ICompanyRepository,
  COMPANY_REPOSITORY,
} from '../seed-demo-environment/ports/company-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { CompanyNotFoundError } from './errors/company-not-found.error';

export type UpdateCompanyInput = { companyId: string; name: string };

/** docs/specs/10-gestion-companies-users.md, flujo principal backend: actualiza el nombre de una Company. */
@Injectable()
export class UpdateCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: ICompanyRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: UpdateCompanyInput): Promise<Company> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const company = await this.companyRepository.findById(input.companyId, ctx);
      if (!company) {
        throw new CompanyNotFoundError(input.companyId);
      }
      return this.companyRepository.update(company.id, { name: input.name }, ctx);
    });
  }
}
