import { Injectable } from '@nestjs/common';
import { SignalQuality } from './signal-quality.enum';

export const RAW_VARIABLE_CACHE = Symbol('RawVariableCache');

/**
 * Último valor conocido de una Variable cruda de una Machine (spec 13). Detalle
 * interno del Signal Engine para evaluar Signals `FORMULA` multi-variable:
 * nunca expuesto vía REST/WebSocket/Alarmas, a diferencia de la Realtime Cache
 * (`entities/realtime-cache.ts`), que sí es la fuente oficial de estado en
 * tiempo real y está keyed por `signalId`, no por Variable.
 */
export type RawVariableCacheEntry = {
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};

export interface IRawVariableCache {
  get(machineId: string, variableName: string): RawVariableCacheEntry | undefined;
  set(machineId: string, variableName: string, entry: RawVariableCacheEntry): void;
}

/** Única instancia compartida, igual que `InMemoryRealtimeCache` (mismo motivo: es estado en memoria). */
@Injectable()
export class InMemoryRawVariableCache implements IRawVariableCache {
  private readonly entries = new Map<string, RawVariableCacheEntry>();

  get(machineId: string, variableName: string): RawVariableCacheEntry | undefined {
    return this.entries.get(this.key(machineId, variableName));
  }

  set(machineId: string, variableName: string, entry: RawVariableCacheEntry): void {
    this.entries.set(this.key(machineId, variableName), entry);
  }

  private key(machineId: string, variableName: string): string {
    return `${machineId}:${variableName}`;
  }
}
