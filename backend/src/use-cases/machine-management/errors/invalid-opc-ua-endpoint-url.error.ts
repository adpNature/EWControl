export class InvalidOpcUaEndpointUrlError extends Error {
  constructor() {
    super('El endpoint OPC UA debe tener la forma opc.tcp://host[:puerto].');
    this.name = 'InvalidOpcUaEndpointUrlError';
  }
}
