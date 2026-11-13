import { describe, expect, it } from 'vitest';
import { RECONNECTION_POLICY_DEFAULTS, ReconnectionPolicy } from './reconnection-policy';

const MINUTE = 60_000;

function createPolicy() {
  let now = 0;
  const policy = new ReconnectionPolicy(() => now);
  return {
    policy,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe('ReconnectionPolicy (docs/specs/24-conexion-opc-ua-estable.md, criterio 4)', () => {
  it('usa los valores de la spec por defecto', () => {
    expect(RECONNECTION_POLICY_DEFAULTS).toEqual({
      maxDisconnections: 3,
      windowMs: 5 * MINUTE,
      initialPauseMs: 1 * MINUTE,
      maxPauseMs: 15 * MINUTE,
      stableMs: 10 * MINUTE,
    });
  });

  it('no pausa con menos de 3 cortes en 5 minutos', () => {
    const { policy, advance } = createPolicy();
    policy.recordConnected();

    expect(policy.recordDisconnection()).toEqual({ pause: false });
    advance(MINUTE);
    expect(policy.recordDisconnection()).toEqual({ pause: false });
  });

  it('al tercer corte en 5 minutos pausa 1 minuto', () => {
    const { policy, advance } = createPolicy();
    policy.recordConnected();
    policy.recordDisconnection();
    advance(20_000);
    policy.recordDisconnection();
    advance(20_000);

    expect(policy.recordDisconnection()).toEqual({ pause: true, delayMs: MINUTE });
  });

  it('los cortes fuera de la ventana de 5 minutos no cuentan', () => {
    const { policy, advance } = createPolicy();
    policy.recordDisconnection();
    advance(3 * MINUTE);
    policy.recordDisconnection();
    advance(3 * MINUTE);

    expect(policy.recordDisconnection()).toEqual({ pause: false });
  });

  it('las pausas siguientes se duplican hasta 15 minutos', () => {
    const { policy, advance } = createPolicy();
    const pauses: number[] = [];
    for (let round = 0; round < 6; round += 1) {
      let decision = policy.recordDisconnection();
      while (!decision.pause) {
        advance(10_000);
        decision = policy.recordDisconnection();
      }
      pauses.push(decision.delayMs);
      advance(decision.delayMs);
      policy.recordConnected();
      advance(10_000);
    }

    expect(pauses).toEqual([1, 2, 4, 8, 15, 15].map((minutes) => minutes * MINUTE));
  });

  it('10 minutos conectado sin cortes reinician la pausa a 1 minuto', () => {
    const { policy, advance } = createPolicy();
    for (let index = 0; index < 3; index += 1) policy.recordDisconnection();
    for (let index = 0; index < 3; index += 1) policy.recordDisconnection();
    policy.recordConnected();
    advance(10 * MINUTE);

    policy.recordDisconnection();
    policy.recordDisconnection();
    expect(policy.recordDisconnection()).toEqual({ pause: true, delayMs: MINUTE });
  });

  it('un corte antes de llevar 10 minutos conectado no reinicia la pausa', () => {
    const { policy, advance } = createPolicy();
    for (let index = 0; index < 3; index += 1) policy.recordDisconnection();
    policy.recordConnected();
    advance(9 * MINUTE);

    policy.recordDisconnection();
    policy.recordDisconnection();
    expect(policy.recordDisconnection()).toEqual({ pause: true, delayMs: 2 * MINUTE });
  });
});
