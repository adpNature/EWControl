import type { DataQuality } from './data-quality.enum';
import type { VariableType } from './variable-type.enum';

/**
 * Dato bruto recibido desde un Source y publicado por un Data Provider
 * (Documento 2, apartado 2.4, "Variables Publicadas"). Pertenece únicamente
 * al proveedor de datos: nunca es utilizada directamente por el resto de la plataforma.
 */
export type Variable = {
  name: string;
  value: number | boolean | string;
  type: VariableType;
  timestamp: Date;
  quality: DataQuality;
};
