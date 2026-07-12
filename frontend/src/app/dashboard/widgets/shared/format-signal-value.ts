const DEFAULT_DECIMALS = 2;

/**
 * Formato numérico compartido por los widgets con datos (docs/12-convenciones-frontend.md):
 * como máximo `decimals` decimales (2 por defecto), con coma decimal (`es-ES`).
 * Los valores no numéricos (booleanos de RunStop, etc.) se muestran tal cual.
 */
export function formatSignalValue(
  value: number | boolean | string,
  decimals: number = DEFAULT_DECIMALS,
): string {
  if (typeof value !== 'number') {
    return String(value);
  }
  return value.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
