import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.enum';
import {
  type IPasswordHasher,
  PASSWORD_HASHER,
} from '../seed-demo-environment/ports/password-hasher.port';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../seed-demo-environment/ports/user-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { Requester } from './user-access.resolver';
import { CannotCreateSuperAdminError } from './errors/cannot-create-superadmin.error';
import { CompanyIdRequiredError } from './errors/company-id-required.error';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';

export type CreateUserInput = {
  requester: Requester;
  companyId?: string;
  email: string;
  password: string;
  role: UserRole;
};

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: alta de
 * un User. Un `AdminCliente` siempre crea en su propia Company (ignora
 * cualquier `companyId` del input) y nunca puede crear un `SuperAdmin`; un
 * `SuperAdmin` debe indicar explícitamente en qué Company se crea.
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: CreateUserInput): Promise<User> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      if (input.requester.role === UserRole.AdminCliente && input.role === UserRole.SuperAdmin) {
        throw new CannotCreateSuperAdminError();
      }

      const companyId =
        input.requester.role === UserRole.SuperAdmin ? input.companyId : input.requester.companyId;
      if (!companyId) {
        throw new CompanyIdRequiredError();
      }

      const existing = await this.userRepository.findByEmail(input.email, ctx);
      if (existing) {
        throw new EmailAlreadyExistsError(input.email);
      }

      const passwordHash = await this.passwordHasher.hash(input.password);
      return this.userRepository.create(
        { companyId, email: input.email, passwordHash, role: input.role },
        ctx,
      );
    });
  }
}
