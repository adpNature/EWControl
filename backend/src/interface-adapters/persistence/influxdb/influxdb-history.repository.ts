import { Inject, Injectable } from '@nestjs/common';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { influxdbConnectionOptions } from '../../../frameworks-drivers/config/influxdb.config';
import { INFLUXDB_CLIENT } from '../../../frameworks-drivers/database/influxdb.client';
import {
  HistoryQueryBatchParams,
  HistoryQueryBatchPoint,
  HistoryQueryParams,
  HistoryQueryPoint,
  IHistoryReader,
} from '../../../use-cases/history/ports/history-reader.port';
import { HistoryPoint, IHistoryWriter } from '../../../use-cases/history/ports/history-writer.port';

const MEASUREMENT = 'signal_values';

const AGGREGATE_WINDOW_BY_RESOLUTION: Record<
  Exclude<HistoryQueryParams['resolution'], 'raw'>,
  string
> = {
  minute: '1m',
  hour: '1h',
  day: '1d',
  month: '1mo',
};

/**
 * Adaptador de `IHistoryWriter`/`IHistoryReader` sobre InfluxDB
 * (docs/04-persistencia-de-datos.md §4.3): un bucket, una measurement, tags
 * `company_id`/`machine_id`/`signal_id`, field `value`.
 */
@Injectable()
export class InfluxDbHistoryRepository implements IHistoryWriter, IHistoryReader {
  constructor(@Inject(INFLUXDB_CLIENT) private readonly client: InfluxDB) {}

  async writeBatch(points: HistoryPoint[]): Promise<void> {
    const { org, bucket } = influxdbConnectionOptions();
    const writeApi = this.client.getWriteApi(org, bucket, 'ms');
    try {
      writeApi.writePoints(
        points.map((point) =>
          new Point(MEASUREMENT)
            .tag('company_id', point.companyId)
            .tag('machine_id', point.machineId)
            .tag('signal_id', point.signalId)
            .floatField('value', point.value)
            .timestamp(point.timestamp),
        ),
      );
      await writeApi.flush();
    } finally {
      await writeApi.close();
    }
  }

  async hasDataInRange(machineId: string, from: Date, to: Date): Promise<boolean> {
    const { org, bucket } = influxdbConnectionOptions();
    const queryApi = this.client.getQueryApi(org);
    const flux = `from(bucket: "${bucket}")
      |> range(start: ${from.toISOString()}, stop: ${to.toISOString()})
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.machine_id == "${machineId}")
      |> limit(n: 1)`;
    const rows = await queryApi.collectRows(flux);
    return rows.length > 0;
  }

  async deleteRange(machineId: string, from: Date, to: Date): Promise<void> {
    await this.deleteByPredicate(
      `_measurement="${MEASUREMENT}" AND machine_id="${machineId}"`,
      from,
      to,
    );
  }

  async deleteAllForCompany(companyId: string, until: Date): Promise<void> {
    await this.deleteByPredicate(
      `_measurement="${MEASUREMENT}" AND company_id="${companyId}"`,
      new Date(0),
      until,
    );
  }

  private async deleteByPredicate(predicate: string, from: Date, to: Date): Promise<void> {
    const { url, token, org, bucket } = influxdbConnectionOptions();
    const headers = new Headers();
    headers.set('Authorization', `Token ${token}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(
      `${url}/api/v2/delete?org=${encodeURIComponent(org ?? '')}&bucket=${encodeURIComponent(bucket)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ start: from.toISOString(), stop: to.toISOString(), predicate }),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`InfluxDB delete falló con status ${response.status}: ${body}`);
    }
  }

  async queryRange(params: HistoryQueryParams): Promise<HistoryQueryPoint[]> {
    const { org, bucket } = influxdbConnectionOptions();
    const queryApi = this.client.getQueryApi(org);
    const aggregation =
      params.resolution === 'raw'
        ? ''
        : `|> aggregateWindow(every: ${AGGREGATE_WINDOW_BY_RESOLUTION[params.resolution]}, fn: mean, createEmpty: false)`;
    const flux = `from(bucket: "${bucket}")
      |> range(start: ${params.from.toISOString()}, stop: ${params.to.toISOString()})
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.signal_id == "${params.signalId}" and r._field == "value")
      ${aggregation}
      |> sort(columns: ["_time"])`;
    const rows = await queryApi.collectRows<{ _time: string; _value: number }>(flux);
    return rows.map((row) => ({ timestamp: new Date(row._time), value: row._value }));
  }

  /**
   * docs/specs/14-historicos-comparativas.md: histórico de varias Signals en una
   * sola consulta Flux. `range`/`filter` mantienen una tabla por tag-set, así que
   * `aggregateWindow` sigue agregando cada `signal_id` de forma independiente
   * aunque el filtro cubra varios a la vez. El filtro por `signal_id` se
   * construye como una cadena de igualdades (`or`), nunca con `contains()`:
   * en esta versión de InfluxDB, `contains()` impide el pushdown del
   * predicado al índice de series y degrada a un escaneo completo del rango
   * (verificado manualmente: ~40s con `contains()` frente a <1s con `or`
   * para el mismo rango de 30 días, incluso con una sola Signal).
   */
  async queryRangeBatch(params: HistoryQueryBatchParams): Promise<HistoryQueryBatchPoint[]> {
    const { org, bucket } = influxdbConnectionOptions();
    const queryApi = this.client.getQueryApi(org);
    const aggregation =
      params.resolution === 'raw'
        ? ''
        : `|> aggregateWindow(every: ${AGGREGATE_WINDOW_BY_RESOLUTION[params.resolution]}, fn: mean, createEmpty: false)`;
    const signalIdFilter = params.signalIds
      .map((signalId) => `r.signal_id == "${signalId}"`)
      .join(' or ');
    const flux = `from(bucket: "${bucket}")
      |> range(start: ${params.from.toISOString()}, stop: ${params.to.toISOString()})
      |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and (${signalIdFilter}) and r._field == "value")
      ${aggregation}
      |> sort(columns: ["_time"])`;
    const rows = await queryApi.collectRows<{
      _time: string;
      _value: number;
      // eslint-disable-next-line @typescript-eslint/naming-convention -- tag de InfluxDB, no renombrable
      signal_id: string;
    }>(flux);
    return rows.map((row) => ({
      signalId: row.signal_id,
      timestamp: new Date(row._time),
      value: row._value,
    }));
  }
}
