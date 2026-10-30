/**
 * spec 18: el servidor OPC UA no respondió a una exploración de nodos. El
 * detalle técnico solo va al log del adaptador; el mensaje es genérico (OWASP A05).
 */
export class OpcUaEndpointUnreachableError extends Error {
  constructor() {
    super('No se pudo conectar con el servidor OPC UA.');
    this.name = 'OpcUaEndpointUnreachableError';
  }
}
