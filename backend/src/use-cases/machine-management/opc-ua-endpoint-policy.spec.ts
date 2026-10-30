import { describe, expect, it } from 'vitest';
import { InvalidOpcUaEndpointUrlError } from './errors/invalid-opc-ua-endpoint-url.error';
import { OpcUaEndpointNotAllowedError } from './errors/opc-ua-endpoint-not-allowed.error';
import { isHostAllowed, OpcUaEndpointPolicy } from './opc-ua-endpoint-policy';

describe('isHostAllowed', () => {
  it('con la allowlist vacía permite cualquier host (modo local de planta)', () => {
    expect(isHostAllowed('192.168.1.1', [])).toBe(true);
    expect(isHostAllowed('plc.example.com', [])).toBe(true);
  });

  it('acepta un host listado literalmente, sin distinguir mayúsculas', () => {
    expect(isHostAllowed('PLC-1.local', ['plc-1.local'])).toBe(true);
    expect(isHostAllowed('10.0.0.5', ['10.0.0.5'])).toBe(true);
  });

  it('acepta una IPv4 dentro de un rango CIDR', () => {
    expect(isHostAllowed('192.168.1.1', ['192.168.1.0/24'])).toBe(true);
    expect(isHostAllowed('192.168.1.1', ['192.168.1.1/32'])).toBe(true);
    expect(isHostAllowed('10.20.30.40', ['0.0.0.0/0'])).toBe(true);
  });

  it('rechaza una IPv4 fuera de todos los rangos y hosts listados', () => {
    expect(isHostAllowed('192.168.2.1', ['192.168.1.0/24', '10.0.0.5'])).toBe(false);
    expect(isHostAllowed('169.254.169.254', ['192.168.1.0/24'])).toBe(false);
  });

  it('un CIDR nunca casa con un hostname (no se resuelve DNS)', () => {
    expect(isHostAllowed('plc.local', ['192.168.1.0/24'])).toBe(false);
  });

  it('ignora entradas CIDR mal formadas sin lanzar', () => {
    expect(isHostAllowed('192.168.1.1', ['192.168.1.0/40', 'not-an-ip/24', '300.1.1.1/8'])).toBe(
      false,
    );
  });
});

describe('OpcUaEndpointPolicy', () => {
  it('devuelve el endpoint cuando su host está permitido', () => {
    const policy = new OpcUaEndpointPolicy(['192.168.1.0/24']);

    expect(() => policy.assertAllowed('opc.tcp://192.168.1.1:4840')).not.toThrow();
  });

  it('lanza InvalidOpcUaEndpointUrlError si el esquema no es opc.tcp://', () => {
    const policy = new OpcUaEndpointPolicy([]);

    expect(() => policy.assertAllowed('http://192.168.1.1')).toThrow(InvalidOpcUaEndpointUrlError);
  });

  it('lanza OpcUaEndpointNotAllowedError si el host está fuera de la allowlist', () => {
    const policy = new OpcUaEndpointPolicy(['192.168.1.0/24']);

    expect(() => policy.assertAllowed('opc.tcp://10.0.0.1:4840')).toThrow(
      OpcUaEndpointNotAllowedError,
    );
  });
});
