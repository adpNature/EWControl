import { SignalQuality } from './signal-quality.enum';

/**
 * Entrada de un tick ya traducido a valores de dominio (Documento 2, apartado 2.5).
 * La traducción desde `Variable`/`DataQuality` (Interface Adapters) ocurre en quien
 * llama a esta función, nunca aquí: entities no conoce Data Providers.
 */
export type DirectTickInput = {
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};

export type ResolvedSignalValue = {
  value: number | boolean | string;
  quality: SignalQuality;
  timestamp: Date;
};

/**
 * Resuelve el valor de una Signal `DIRECT`: hoy es un mapeo identidad porque el
 * valor de la Variable ya es el valor de la Signal (Documento 3, apartado 3.2.5).
 * Es el único punto donde un futuro evaluador de Signals `FORMULA` se conectaría,
 * sin modificar a quien llama.
 */
export function resolveDirectSignalValue(input: DirectTickInput): ResolvedSignalValue {
  return { value: input.value, quality: input.quality, timestamp: input.timestamp };
}
