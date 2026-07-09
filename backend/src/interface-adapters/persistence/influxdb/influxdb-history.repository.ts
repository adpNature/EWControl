import { Inject, Injectable } from '@nestjs/common';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { influxdbConnectionOptions } from '../../../frameworks-drivers/config/influxdb.config';
import { INFLUXDB_CLIENT } from '../../../frameworks-drivers/database/influxdb.client';
import { HistoryPoint, IHistoryWriter } from '../../../use-cases/history/ports/history-writer.port';

const MEASUREMENT = 'signal_values';

/**
 * Adaptador de `IHistoryWriter` sobre InfluxDB (docs/04-persistencia-de-datos.md §4.3):
 * un bucket, una measurement, tags `company_id`/`machine_id`/`signal_id`, field `value`.
 */
@Injectable()
export class InfluxDbHistoryRepository implements IHistoryWriter {
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
    const { url, token, org, bucket } = influxdbConnectionOptions();
    const headers = new Headers();
    headers.set('Authorization', `Token ${token}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(
      `${url}/api/v2/delete?org=${encodeURIComponent(org ?? '')}&bucket=${encodeURIComponent(bucket)}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          start: from.toISOString(),
          stop: to.toISOString(),
          predicate: `_measurement="${MEASUREMENT}" AND machine_id="${machineId}"`,
        }),
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`InfluxDB delete falló con status ${response.status}: ${body}`);
    }
  }
}
