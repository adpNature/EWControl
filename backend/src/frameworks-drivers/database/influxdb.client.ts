import { InfluxDB } from '@influxdata/influxdb-client';
import { influxdbConnectionOptions } from '../config/influxdb.config';

export const INFLUXDB_CLIENT = Symbol('InfluxDBClient');

/** Cliente InfluxDB compartido; `WriteApi`/`QueryApi` se derivan de él por caso de uso. */
export function createInfluxDbClient(): InfluxDB {
  const { url, token } = influxdbConnectionOptions();
  return new InfluxDB({ url, token });
}
