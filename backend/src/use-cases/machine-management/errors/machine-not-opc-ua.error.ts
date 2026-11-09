/** spec 21: la sincronización de variables solo tiene sentido en una Machine con conexión `OpcUa`. */
export class MachineNotOpcUaError extends Error {
  constructor(readonly machineId: string) {
    super(`La Machine "${machineId}" no tiene una conexión OPC UA.`);
    this.name = 'MachineNotOpcUaError';
  }
}
