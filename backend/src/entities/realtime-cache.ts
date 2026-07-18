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
  /** docs/07-observabilidad-monitorizacion.md, apartado 7.6 (spec 15). */
  correlationId: string;
};

export interface IRealtimeCache {
  get(signalId: string): RealtimeCacheEntry | undefined;
  set(entry: RealtimeCacheEntry): void;
  /** Número de Signals con estado actual en la cache (spec 15, métrica de Realtime Cache). */
  size(): number;
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

  size(): number {
    return this.entries.size;
  }
}
