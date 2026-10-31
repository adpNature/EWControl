import type { WriteValue } from '../../../entities/write-package.vo';

export const MACHINE_WRITER = Symbol('MachineWriter');

export type MachineWriteItem = { nodeId: string; dataType: string; value: WriteValue };

/** `StatusCode` OPC UA de cada valor, en el mismo orden que la petición. */
export type MachineWriteResult = { nodeId: string; statusCode: string };

/**
 * Escribe en el PLC de una Machine con su sesión ya abierta
 * (docs/specs/20-paquetes-escritura-opc-ua.md). Lo implementa el registry de
 * Data Providers OPC UA: el caso de uso no conoce OPC UA ni node-opcua.
 */
export interface IMachineWriter {
  /** Si la Machine tiene ahora una sesión OPC UA activa (para habilitar "Ejecutar" en la UI). */
  isConnected(machineId: string): boolean;
  /**
   * Todos los valores en una sola petición `Write`.
   * @throws MachineNotConnectedError si la Machine no tiene sesión OPC UA activa.
   * @throws WriteInProgressError si ya hay una escritura en curso en esa Machine.
   * @throws WriteTimeoutError si el servidor no responde en `timeoutMs`.
   */
  write(machineId: string, items: MachineWriteItem[]): Promise<MachineWriteResult[]>;
}
