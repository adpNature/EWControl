import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { HistoryApiService } from '../adapters/history-api.service';
import { HistoryComparisonResponse } from '../entities/history-comparison.model';

/**
 * Estado de la comparativa de históricos (docs/specs/14-historicos-comparativas.md):
 * `loadComparison` trae la comparativa completa vía REST y sustituye siempre
 * todas las series a la vez (no hay acumulación incremental por WebSocket, a
 * diferencia del widget CHART). `clearSelection` se usa explícitamente cuando
 * un SuperAdmin cambia de Company, para no arrastrar una selección que ya no
 * pertenece a la Company recién elegida.
 */
@Injectable({ providedIn: 'root' })
export class HistoryComparisonState {
  private readonly historyApi = inject(HistoryApiService);

  private readonly selectedSignalIdsSignal = signal<string[]>([]);
  private readonly comparisonSignal = signal<HistoryComparisonResponse | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal(false);

  readonly selectedSignalIds = this.selectedSignalIdsSignal.asReadonly();
  readonly comparison = this.comparisonSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  setSelectedSignalIds(signalIds: string[]): void {
    this.selectedSignalIdsSignal.set(signalIds);
  }

  loadComparison(
    range: { from: Date; to: Date },
    companyId?: string,
  ): Observable<HistoryComparisonResponse> {
    this.loadingSignal.set(true);
    this.errorSignal.set(false);
    return this.historyApi.getComparison(this.selectedSignalIdsSignal(), range, companyId).pipe(
      tap({
        next: (response) => {
          this.comparisonSignal.set(response);
          this.loadingSignal.set(false);
        },
        error: () => {
          this.errorSignal.set(true);
          this.loadingSignal.set(false);
        },
      }),
    );
  }

  clearSelection(): void {
    this.selectedSignalIdsSignal.set([]);
    this.comparisonSignal.set(null);
    this.errorSignal.set(false);
  }
}
