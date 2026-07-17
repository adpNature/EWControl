import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { HistoryComparisonResponse } from '../entities/history-comparison.model';

/** Interface Adapter: llamada HTTP de docs/specs/14-historicos-comparativas.md. */
@Injectable({ providedIn: 'root' })
export class HistoryApiService {
  private readonly api = inject(ApiService);

  getComparison(
    signalIds: string[],
    range: { from: Date; to: Date },
    companyId?: string,
  ): Observable<HistoryComparisonResponse> {
    const params: Record<string, string | number> = {
      signalIds: signalIds.join(','),
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    };
    if (companyId) {
      params['companyId'] = companyId;
    }
    return this.api.get<HistoryComparisonResponse>('/signals/history', params);
  }
}
