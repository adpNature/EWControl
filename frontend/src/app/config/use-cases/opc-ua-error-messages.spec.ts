import { opcUaApiErrorMessage, opcUaTestResultMessage } from './opc-ua-error-messages';

describe('opcUaApiErrorMessage', () => {
  it.each([
    ['OPCUA_ENDPOINT_UNREACHABLE', /No se ha podido conectar/],
    ['OPCUA_ENDPOINT_NOT_ALLOWED', /no está permitido/],
    ['INVALID_ENDPOINT_URL', /opc\.tcp/],
    ['OPCUA_INVALID_NODE_ID', /ya no existe/],
    ['INVALID_CONNECTION_CONFIG', /no es válida/],
    ['MACHINE_INACTIVE', /desactivada/],
    ['ALGO_DESCONOCIDO', /Inténtalo de nuevo/],
  ])('traduce %s', (code, expected) => {
    expect(opcUaApiErrorMessage({ status: 400, code, message: '' })).toMatch(expected);
  });
});

describe('opcUaTestResultMessage', () => {
  it('informa del éxito', () => {
    expect(opcUaTestResultMessage({ reachable: true })).toMatch(/Conexión establecida/);
  });

  it.each([
    ['UNREACHABLE', /no responde/],
    ['TIMEOUT', /a tiempo/],
    ['SECURITY_REJECTED', /rechazado/],
  ] as const)('explica el motivo %s', (reason, expected) => {
    expect(opcUaTestResultMessage({ reachable: false, reason })).toMatch(expected);
  });
});
