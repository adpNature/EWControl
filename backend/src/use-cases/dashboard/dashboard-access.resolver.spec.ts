import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { DashboardAccessResolver } from './dashboard-access.resolver';
import { DashboardNotFoundError } from './errors/dashboard-not-found.error';

const FAKE_CTX = Symbol('tx-ctx');
const DASHBOARD = { id: 'dashboard-1', companyId: 'company-1', name: 'Planta 1' };

function createFakes() {
  const dashboardRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(DASHBOARD),
    list: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { dashboardRepository };
}

function createResolver(fakes: ReturnType<typeof createFakes>) {
  return new DashboardAccessResolver(fakes.dashboardRepository);
}

describe('DashboardAccessResolver', () => {
  it('devuelve el Dashboard cuando existe y pertenece a la Company del requester', async () => {
    const fakes = createFakes();
    const resolver = createResolver(fakes);

    const dashboard = await resolver.resolveAny(
      'dashboard-1',
      { companyId: 'company-1', role: UserRole.AdminCliente },
      FAKE_CTX,
    );

    expect(dashboard).toEqual(DASHBOARD);
  });

  it('lanza DashboardNotFoundError si el Dashboard no existe', async () => {
    const fakes = createFakes();
    fakes.dashboardRepository.findById.mockResolvedValue(null);
    const resolver = createResolver(fakes);

    await expect(
      resolver.resolveAny(
        'missing',
        { companyId: 'company-1', role: UserRole.AdminCliente },
        FAKE_CTX,
      ),
    ).rejects.toBeInstanceOf(DashboardNotFoundError);
  });

  it('lanza DashboardNotFoundError (nunca 403) si el Dashboard es de otra Company y el requester es AdminCliente', async () => {
    const fakes = createFakes();
    const resolver = createResolver(fakes);

    await expect(
      resolver.resolveAny(
        'dashboard-1',
        { companyId: 'other-company', role: UserRole.AdminCliente },
        FAKE_CTX,
      ),
    ).rejects.toBeInstanceOf(DashboardNotFoundError);
  });

  it('devuelve el Dashboard de otra Company si el requester es SuperAdmin', async () => {
    const fakes = createFakes();
    const resolver = createResolver(fakes);

    const dashboard = await resolver.resolveAny(
      'dashboard-1',
      { companyId: 'other-company', role: UserRole.SuperAdmin },
      FAKE_CTX,
    );

    expect(dashboard).toEqual(DASHBOARD);
  });
});
