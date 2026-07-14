import { Company } from '../../../entities/company.entity';
import { TransactionContext } from './transaction-context';

export const COMPANY_REPOSITORY = Symbol('CompanyRepository');

export interface ICompanyRepository {
  findByName(name: string, ctx: TransactionContext): Promise<Company | null>;
  /** docs/specs/09-alarmas.md: nombre de la Company para el contenido del email de notificación. */
  findById(id: string, ctx: TransactionContext): Promise<Company | null>;
  create(data: { name: string }, ctx: TransactionContext): Promise<Company>;
  /**
   * docs/specs/10-gestion-companies-users.md, flujo principal backend: lista
   * TODAS las Companies (activas e inactivas), a diferencia de Machine/Signal
   * — no hay reactivación de una Company dada de baja todavía, así que ocultar
   * las inactivas dejaría al SuperAdmin sin forma de verlas.
   */
  list(
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Company[]; total: number }>;
  update(id: string, changes: { name: string }, ctx: TransactionContext): Promise<Company>;
  deactivate(id: string, ctx: TransactionContext): Promise<Company>;
}
