import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import type { HistoryResolution } from '../../../use-cases/history/ports/history-reader.port';

const RESOLUTIONS: HistoryResolution[] = ['raw', 'minute', 'hour', 'day', 'month'];

/** docs/specs/08-historicos.md: query de `GET .../signals/:id/history`. */
export class HistoryQueryDto {
  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;

  @IsOptional()
  @IsIn(RESOLUTIONS)
  resolution?: HistoryResolution;
}
