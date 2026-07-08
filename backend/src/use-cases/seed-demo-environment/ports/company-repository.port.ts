import { Company } from '../../../entities/company.entity';
import { TransactionContext } from './transaction-context';

export const COMPANY_REPOSITORY = Symbol('CompanyRepository');

export interface ICompanyRepository {
  findByName(name: string, ctx: TransactionContext): Promise<Company | null>;
  create(data: { name: string }, ctx: TransactionContext): Promise<Company>;
}
