import {
  canConfigure,
  canManageCompanies,
  canManageUsers,
  canAccessConfig,
} from './config-permissions';

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

describe('canManageUsers', () => {
  it('permite AdminCliente', () => {
    expect(canManageUsers('AdminCliente')).toBe(true);
  });

  it('permite SuperAdmin', () => {
    expect(canManageUsers('SuperAdmin')).toBe(true);
  });

  it('deniega si no hay rol', () => {
    expect(canManageUsers(undefined)).toBe(false);
  });
});

describe('rol Operador (docs/specs/19-rol-operador.md)', () => {
  it('no puede configurar, gestionar Users ni Companies, ni entrar en /config', () => {
    expect(canConfigure('Operador')).toBe(false);
    expect(canManageUsers('Operador')).toBe(false);
    expect(canManageCompanies('Operador')).toBe(false);
    expect(canAccessConfig('Operador')).toBe(false);
  });

  it('canAccessConfig permite a AdminCliente y SuperAdmin', () => {
    expect(canAccessConfig('AdminCliente')).toBe(true);
    expect(canAccessConfig('SuperAdmin')).toBe(true);
    expect(canAccessConfig(undefined)).toBe(false);
  });
});
