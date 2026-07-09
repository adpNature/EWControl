/**
 * Opciones de conexión a InfluxDB, compartidas por el cliente HTTP/write/query
 * y por el adaptador de borrado (docs/04-persistencia-de-datos.md §4.3), igual
 * que `postgres.config.ts` centraliza la lectura de variables de entorno para Postgres.
 */
export function influxdbConnectionOptions(): {
  url: string;
  token: string;
  org: string;
  bucket: string;
} {
  return {
    url: process.env.INFLUXDB_URL ?? '',
    token: process.env.INFLUXDB_TOKEN ?? '',
    org: process.env.INFLUXDB_ORG ?? '',
    bucket: process.env.INFLUXDB_BUCKET ?? 'signals_history',
  };
}
