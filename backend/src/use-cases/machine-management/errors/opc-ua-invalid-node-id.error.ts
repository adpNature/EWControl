export class OpcUaInvalidNodeIdError extends Error {
  constructor(nodeId: string) {
    super(`El NodeId "${nodeId}" no es válido.`);
    this.name = 'OpcUaInvalidNodeIdError';
  }
}
