import { canConfigure, canManageCompanies } from './config-permissions';

describe('canConfigure', () => {
  it('permite AdminCliente', () => {
    expect(canConfigure('AdminCliente')).toBe(true);
  });

  it('permite SuperAdmin', () => {
    expect(canConfigure('SuperAdmin')).toBe(true);
  });

  it('deniega si no hay rol', () => {
    expect(canConfigure(undefined)).toBe(false);
  });
});

describe('canManageCompanies', () => {
  it('permite SuperAdmin', () => {
    expect(canManageCompanies('SuperAdmin')).toBe(true);
  });

  it('deniega AdminCliente', () => {
    expect(canManageCompanies('AdminCliente')).toBe(false);
  });

  it('deniega si no hay rol', () => {
    expect(canManageCompanies(undefined)).toBe(false);
  });
});
