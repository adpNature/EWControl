import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
} from 'class-validator';
import type { HistoryResolution } from '../../../use-cases/history/ports/history-reader.port';

const RESOLUTIONS: HistoryResolution[] = ['raw', 'minute', 'hour', 'day', 'month'];

export const MAX_SIGNALS_PER_HISTORY_COMPARISON = 8;

/** docs/specs/14-historicos-comparativas.md: query de `GET /api/v1/signals/history`. */
export class HistoryComparisonQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SIGNALS_PER_HISTORY_COMPARISON)
  @IsUUID(undefined, { each: true })
  signalIds!: string[];

  @IsISO8601()
  from!: string;

  @IsISO8601()
  to!: string;

  @IsOptional()
  @IsIn(RESOLUTIONS)
  resolution?: HistoryResolution;

  /** Solo tiene efecto para SuperAdmin; un AdminCliente lo ve siempre ignorado. */
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
