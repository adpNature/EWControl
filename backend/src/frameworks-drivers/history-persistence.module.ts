import { Module } from '@nestjs/common';
import { InfluxDbHistoryRepository } from '../interface-adapters/persistence/influxdb/influxdb-history.repository';
import { HISTORY_READER } from '../use-cases/history/ports/history-reader.port';
import { HISTORY_WRITER } from '../use-cases/history/ports/history-writer.port';
import { INFLUXDB_CLIENT, createInfluxDbClient } from './database/influxdb.client';

/**
 * Dueño único de la conexión a InfluxDB (docs/specs/08-historicos.md), mismo
 * patrón que `DashboardModule` con `REALTIME_CACHE`: `SimulatorModule` (escritura
 * continua y seed puntual) y `MachineManagementModule` (consulta de histórico)
 * importan este módulo únicamente por estos tokens, en vez de que uno dependa
 * del otro.
 */
@Module({
  providers: [
    { provide: INFLUXDB_CLIENT, useFactory: createInfluxDbClient },
    InfluxDbHistoryRepository,
    { provide: HISTORY_WRITER, useExisting: InfluxDbHistoryRepository },
    { provide: HISTORY_READER, useExisting: InfluxDbHistoryRepository },
  ],
  exports: [HISTORY_WRITER, HISTORY_READER],
})
export class HistoryPersistenceModule {}
