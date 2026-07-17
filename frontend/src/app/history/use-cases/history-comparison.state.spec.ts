import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HistoryApiService } from '../adapters/history-api.service';
import { HistoryComparisonResponse } from '../entities/history-comparison.model';
import { HistoryComparisonState } from './history-comparison.state';

const RESPONSE: HistoryComparisonResponse = {
  resolution: 'raw',
  series: [{ signalId: 'signal-1', machineId: 'machine-1', points: [] }],
};
const RANGE = { from: new Date('2026-07-12T09:00:00Z'), to: new Date('2026-07-12T10:00:00Z') };

describe('HistoryComparisonState', () => {
  let service: HistoryComparisonState;
  let historyApi: { getComparison: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    historyApi = { getComparison: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: HistoryApiService, useValue: historyApi }],
    });
    service = TestBed.inject(HistoryComparisonState);
  });

  it('setSelectedSignalIds actualiza el signal de selección', () => {
    service.setSelectedSignalIds(['signal-1', 'signal-2']);

    expect(service.selectedSignalIds()).toEqual(['signal-1', 'signal-2']);
  });

  it('loadComparison pide la selección actual y sincroniza el signal comparison', async () => {
    service.setSelectedSignalIds(['signal-1']);
    historyApi.getComparison.mockReturnValue(of(RESPONSE));

    await new Promise((resolve, reject) =>
      service.loadComparison(RANGE).subscribe({ next: resolve, error: reject }),
    );

    expect(historyApi.getComparison).toHaveBeenCalledWith(['signal-1'], RANGE, undefined);
    expect(service.comparison()).toEqual(RESPONSE);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe(false);
  });

  it('loadComparison pasa companyId cuando se indica', async () => {
    service.setSelectedSignalIds(['signal-1']);
    historyApi.getComparison.mockReturnValue(of(RESPONSE));

    await new Promise((resolve, reject) =>
      service.loadComparison(RANGE, 'company-1').subscribe({ next: resolve, error: reject }),
    );

    expect(historyApi.getComparison).toHaveBeenCalledWith(['signal-1'], RANGE, 'company-1');
  });

  it('loadComparison en fallo marca error y apaga loading, sin romper', async () => {
    service.setSelectedSignalIds(['signal-1']);
    historyApi.getComparison.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) =>
        service.loadComparison(RANGE).subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    expect(service.loading()).toBe(false);
    expect(service.error()).toBe(true);
  });

  it('clearSelection limpia selección, comparativa y error', async () => {
    service.setSelectedSignalIds(['signal-1']);
    historyApi.getComparison.mockReturnValue(throwError(() => new Error('boom')));
    await expect(
      new Promise((resolve, reject) =>
        service.loadComparison(RANGE).subscribe({ next: resolve, error: reject }),
      ),
    ).rejects.toBeTruthy();

    service.clearSelection();

    expect(service.selectedSignalIds()).toEqual([]);
    expect(service.comparison()).toBeNull();
    expect(service.error()).toBe(false);
  });
});
