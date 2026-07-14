import { Company } from '../../../entities/company.entity';
import { TransactionContext } from './transaction-context';

export const COMPANY_REPOSITORY = Symbol('CompanyRepository');

export interface ICompanyRepository {
  findByName(name: string, ctx: TransactionContext): Promise<Company | null>;
  /** docs/specs/09-alarmas.md: nombre de la Company para el contenido del email de notificación. */
  findById(id: string, ctx: TransactionContext): Promise<Company | null>;
  create(data: { name: string }, ctx: TransactionContext): Promise<Company>;
}
