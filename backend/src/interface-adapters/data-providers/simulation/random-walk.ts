/** Fuente aleatoria uniforme en [0, 1), inyectable para tests determinísticos. */
export type RandomFn = () => number;

/** Recorta value al rango [min, max] (Documento 10, apartado 10.1). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Delta uniforme en [-stepMax, +stepMax] a partir de una fuente aleatoria en [0, 1). */
export function nextRandomDelta(stepMax: number, random: RandomFn): number {
  return (random() * 2 - 1) * stepMax;
}
