/** Envelope de listado paginado (docs/11-api-rest.md, sección "Paginación"). */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
