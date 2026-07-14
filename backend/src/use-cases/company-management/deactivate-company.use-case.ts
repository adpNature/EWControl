import { Inject, Injectable } from '@nestjs/common';
import {
  type ICompanyRepository,
  COMPANY_REPOSITORY,
} from '../seed-demo-environment/ports/company-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { CompanyNotFoundError } from './errors/company-not-found.error';

export type DeactivateCompanyInput = { companyId: string };

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: baja
 * lógica de una Company. Bloquea el login/refresh de sus Users (docs/specs/05-auth-login.md)
 * sin eliminar ni desactivar físicamente ninguna fila asociada.
 */
@Injectable()
export class DeactivateCompanyUseCase {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepository: ICompanyRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: DeactivateCompanyInput): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const company = await this.companyRepository.findById(input.companyId, ctx);
      if (!company) {
        throw new CompanyNotFoundError(input.companyId);
      }
      await this.companyRepository.deactivate(company.id, ctx);
    });
  }
}
