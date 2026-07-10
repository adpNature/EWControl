import { canConfigure } from './config-permissions';

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
