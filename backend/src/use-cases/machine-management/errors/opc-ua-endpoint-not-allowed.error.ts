/** spec 18, criterio backend 4: host fuera de `OPCUA_ALLOWED_HOSTS` (OWASP A10). */
export class OpcUaEndpointNotAllowedError extends Error {
  constructor(host: string) {
    super(`El host "${host}" no está permitido como endpoint OPC UA.`);
    this.name = 'OpcUaEndpointNotAllowedError';
  }
}
