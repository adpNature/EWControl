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
   * — necesario para que el SuperAdmin pueda ver y reactivar las dadas de baja.
   */
  list(
    pagination: { limit: number; offset: number },
    ctx: TransactionContext,
  ): Promise<{ data: Company[]; total: number }>;
  update(id: string, changes: { name: string }, ctx: TransactionContext): Promise<Company>;
  deactivate(id: string, ctx: TransactionContext): Promise<Company>;
  reactivate(id: string, ctx: TransactionContext): Promise<Company>;
  /** Borrado físico (docs/specs/10-gestion-companies-users.md, "purge"); requiere haber borrado antes sus Users/Machines. */
  delete(id: string, ctx: TransactionContext): Promise<void>;
}
