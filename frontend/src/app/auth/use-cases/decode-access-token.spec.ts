import { decodeAccessToken } from './decode-access-token';

function fakeJwt(payload: unknown): string {
  const base64Url = (input: string) =>
    btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe('decodeAccessToken', () => {
  it('decodifica los claims del payload sin verificar la firma', () => {
    const token = fakeJwt({
      sub: 'user-1',
      email: 'demo@ewcontrol.local',
      companyId: 'company-1',
      role: 'AdminCliente',
    });

    expect(decodeAccessToken(token)).toEqual({
      id: 'user-1',
      email: 'demo@ewcontrol.local',
      companyId: 'company-1',
      role: 'AdminCliente',
    });
  });

  it('devuelve null si el token no tiene forma de JWT (sin segmento de payload)', () => {
    expect(decodeAccessToken('no-es-un-jwt')).toBeNull();
  });

  it('devuelve null si el payload no es JSON válido', () => {
    expect(decodeAccessToken('header.no-es-json-valido.signature')).toBeNull();
  });
});
