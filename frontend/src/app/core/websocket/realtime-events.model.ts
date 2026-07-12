/** Documento 2, apartado 2.6; docs/11-api-rest.md, sección "WebSocket". */
export type SignalQuality = 'GOOD' | 'BAD' | 'UNCERTAIN' | 'OFFLINE';

export interface SignalUpdatedEvent {
  signalId: string;
  machineId: string;
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: string;
}

export interface MachineConnectedEvent {
  machineId: string;
  timestamp: string;
}

export interface MachineDisconnectedEvent {
  machineId: string;
  timestamp: string;
}

/** Entrada de la Realtime Cache devuelta por `GET .../signals/:id/value` (docs/11-api-rest.md). */
export interface SignalValue {
  signalId: string;
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: string;
  updatedAt: string;
}

/** docs/specs/08-historicos.md: punto agregado devuelto por `GET .../signals/:id/history`. */
export interface SignalHistoryPoint {
  timestamp: string;
  value: number;
}

export interface SignalHistoryResponse {
  signalId: string;
  resolution: string;
  points: SignalHistoryPoint[];
}
