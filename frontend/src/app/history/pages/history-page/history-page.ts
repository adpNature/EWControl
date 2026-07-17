import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { CompaniesState } from '../../../config/use-cases/companies.state';
import { SelectedCompanyState } from '../../../config/use-cases/selected-company.state';
import {
  HistoryRange,
  RangeSelectorComponent,
} from '../../../shared/ui/range-selector/range-selector.component';
import { SelectComponent, SelectOption } from '../../../shared/ui/select/select.component';
import { SelectableSignal } from '../../entities/history-comparison.model';
import { HistoryComparisonState } from '../../use-cases/history-comparison.state';
import {
  ChartSeries,
  MultiSeriesChartComponent,
} from './multi-series-chart/multi-series-chart.component';
import { SignalPickerComponent } from './signal-picker/signal-picker.component';

const DEFAULT_RANGE_HOURS = 1;

function defaultRange(): HistoryRange {
  const to = new Date();
  return { from: new Date(to.getTime() - DEFAULT_RANGE_HOURS * 60 * 60 * 1000), to };
}

/**
 * Pantalla independiente de Históricos (docs/specs/14-historicos-comparativas.md):
 * comparativa de hasta 8 Signals cross-Machine en un único gráfico. Un
 * `SuperAdmin` debe elegir explícitamente una Company antes de poder
 * seleccionar Signals (Documento 8, §8.8 Regla 1: nunca se combinan Companies);
 * un `AdminCliente` nunca ve ese selector.
 */
@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    SelectComponent,
    RangeSelectorComponent,
    SignalPickerComponent,
    MultiSeriesChartComponent,
  ],
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss',
})
export class HistoryPage implements OnInit {
  private readonly authState = inject(AuthStateService);
  protected readonly companiesState = inject(CompaniesState);
  protected readonly selectedCompanyState = inject(SelectedCompanyState);
  protected readonly historyState = inject(HistoryComparisonState);

  readonly companyControl = new FormControl('', { nonNullable: true });
  readonly currentRange = signal<HistoryRange>(defaultRange());
  private readonly catalogSignal = signal<Map<string, SelectableSignal>>(new Map());

  readonly companyOptions = computed<SelectOption[]>(() =>
    this.companiesState.companies().map((company) => ({ value: company.id, label: company.name })),
  );

  ngOnInit(): void {
    if (this.isSuperAdmin()) {
      this.companiesState.load().subscribe();
    }
    this.companyControl.valueChanges.subscribe((companyId) => {
      this.selectedCompanyState.select(companyId);
      this.historyState.clearSelection();
    });
  }

  isSuperAdmin(): boolean {
    return this.authState.currentUser()?.role === 'SuperAdmin';
  }

  /** Company efectiva a enviar al Backend: solo tiene sentido para SuperAdmin. */
  effectiveCompanyId(): string | undefined {
    return this.isSuperAdmin()
      ? this.selectedCompanyState.selectedCompanyId() || undefined
      : undefined;
  }

  /** El picker/gráfico solo se muestran cuando hay Company resuelta (siempre para AdminCliente). */
  canPickSignals(): boolean {
    return !this.isSuperAdmin() || this.selectedCompanyState.selectedCompanyId() !== null;
  }

  onSelectionChange(signalIds: string[]): void {
    this.historyState.setSelectedSignalIds(signalIds);
  }

  onCatalogChange(catalog: SelectableSignal[]): void {
    this.catalogSignal.set(new Map(catalog.map((item) => [item.signalId, item])));
  }

  onRangeChange(range: HistoryRange): void {
    this.currentRange.set(range);
    if (this.historyState.comparison() !== null) {
      this.submitCompare();
    }
  }

  canSubmit(): boolean {
    return this.historyState.selectedSignalIds().length > 0 && !this.historyState.loading();
  }

  submitCompare(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.historyState.loadComparison(this.currentRange(), this.effectiveCompanyId()).subscribe({
      error: () => undefined,
    });
  }

  chartSeries(): ChartSeries[] {
    const comparison = this.historyState.comparison();
    if (!comparison) {
      return [];
    }
    const catalog = this.catalogSignal();
    return comparison.series.map((series) => {
      const meta = catalog.get(series.signalId);
      return {
        signalId: series.signalId,
        label: meta ? `${meta.machineName} — ${meta.signalName}` : series.signalId,
        unit: meta?.unit ?? '',
        points: series.points,
      };
    });
  }
}
