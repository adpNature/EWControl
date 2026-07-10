/** Envelope de error uniforme de la API (docs/11-api-rest.md, sección "Errores"). */
export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}
