/** spec 18, criterio backend 3: `connectionConfig` OPC UA que no supera `parseOpcUaConnectionConfig`. */
export class InvalidConnectionConfigError extends Error {
  constructor(reason: string) {
    super(`connectionConfig no es válida: ${reason}`);
    this.name = 'InvalidConnectionConfigError';
  }
}
