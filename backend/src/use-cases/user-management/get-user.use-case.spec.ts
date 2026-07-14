import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { UserNotFoundError } from './errors/user-not-found.error';
import { GetUserUseCase } from './get-user.use-case';

const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const resolver = { resolveActive: vi.fn().mockResolvedValue({ id: 'user-1' }) };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  return { resolver, unitOfWork };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new GetUserUseCase(fakes.resolver as never, fakes.unitOfWork);
}

describe('GetUserUseCase', () => {
  it('delega en el resolver y devuelve el User activo', async () => {
    const fakes = createFakes();
    const useCase = createUseCase(fakes);
    const requester = { companyId: 'company-1', role: UserRole.AdminCliente };

    const user = await useCase.execute({ userId: 'user-1', requester });

    expect(fakes.resolver.resolveActive).toHaveBeenCalledWith('user-1', requester, FAKE_CTX);
    expect(user).toEqual({ id: 'user-1' });
  });

  it('propaga UserNotFoundError del resolver', async () => {
    const fakes = createFakes();
    fakes.resolver.resolveActive.mockRejectedValue(new UserNotFoundError('missing'));
    const useCase = createUseCase(fakes);

    await expect(
      useCase.execute({
        userId: 'missing',
        requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      }),
    ).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
