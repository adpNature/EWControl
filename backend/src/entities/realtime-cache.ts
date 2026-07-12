import { Injectable } from '@nestjs/common';
import { SignalQuality } from './signal-quality.enum';

export const REALTIME_CACHE = Symbol('RealtimeCache');

/**
 * Estado actual de una Signal en la Realtime Cache (Documento 2, apartado 2.6):
 * un único registro por Signal, nunca un histórico.
 */
export type RealtimeCacheEntry = {
  signalId: string;
  machineId: string;
  companyId: string;
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
  updatedAt: Date;
};

export interface IRealtimeCache {
  get(signalId: string): RealtimeCacheEntry | undefined;
  set(entry: RealtimeCacheEntry): void;
}

/**
 * Única implementación de la Realtime Cache (Documento 2, apartado 2.6,
 * "Persistencia": "es un componente de memoria... no constituye una base de datos").
 * Debe existir una única instancia compartida en toda la aplicación (ver
 * `dashboard.module.ts`): duplicarla por módulo, a diferencia de los repositorios
 * TypeORM, dejaría al Signal Engine y a la lectura de valores viendo mapas distintos.
 */
@Injectable()
export class InMemoryRealtimeCache implements IRealtimeCache {
  private readonly entries = new Map<string, RealtimeCacheEntry>();

  get(signalId: string): RealtimeCacheEntry | undefined {
    return this.entries.get(signalId);
  }

  set(entry: RealtimeCacheEntry): void {
    this.entries.set(entry.signalId, entry);
  }
}
