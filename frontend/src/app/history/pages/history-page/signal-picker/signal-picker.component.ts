import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';
import { MachinesApiService } from '../../../../config/adapters/machines-api.service';
import { SignalsApiService } from '../../../../config/adapters/signals-api.service';
import { SelectableSignal } from '../../../entities/history-comparison.model';

/**
 * Tope de Signals por comparativa (docs/specs/14-historicos-comparativas.md,
 * `MAX_SIGNALS_PER_HISTORY_COMPARISON` en `history-comparison-query.dto.ts`
 * del Backend). Duplicado deliberadamente: el Frontend no comparte paquete
 * con el Backend; mantenerlo en sync es responsabilidad de quien cambie uno.
 */
export const MAX_SIGNALS_PER_COMPARISON = 8;

const LIST_ALL = { limit: 100, offset: 0 };

interface MachineSignalGroup {
  machineId: string;
  machineName: string;
  signals: { id: string; name: string; unit: string }[];
}

/**
 * Selector de Signals cross-Machine (docs/specs/14-historicos-comparativas.md):
 * generaliza el patrón de `dashboard-page.ts` (una Machine → sus Signals) a
 * todas las Machines de la Company, componiendo `GET /machines` +
 * `GET /machines/:machineId/signals` ya existentes, sin ningún endpoint nuevo.
 */
@Component({
  selector: 'app-signal-picker',
  standalone: true,
  templateUrl: './signal-picker.component.html',
  styleUrl: './signal-picker.component.scss',
})
export class SignalPickerComponent implements OnInit, OnChanges {
  /** Acota el listado de Machines a una Company (switcher de SuperAdmin); ignorado si no se indica. */
  @Input() companyId?: string;
  @Input() selectedSignalIds: string[] = [];
  @Output() readonly selectionChange = new EventEmitter<string[]>();
  /** Metadatos (Machine/Signal/unidad) de todo lo listado, para que el consumidor etiquete el gráfico. */
  @Output() readonly catalogChange = new EventEmitter<SelectableSignal[]>();

  private readonly machinesApi = inject(MachinesApiService);
  private readonly signalsApi = inject(SignalsApiService);

  readonly groups = signal<MachineSignalGroup[]>([]);
  readonly loading = signal(false);

  readonly maxReached = () => this.selectedSignalIds.length >= MAX_SIGNALS_PER_COMPARISON;

  ngOnInit(): void {
    this.loadGroups();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['companyId'] && !changes['companyId'].firstChange) {
      this.loadGroups();
    }
  }

  isSelected(signalId: string): boolean {
    return this.selectedSignalIds.includes(signalId);
  }

  toggle(signalId: string, checked: boolean): void {
    const next = checked
      ? [...this.selectedSignalIds, signalId]
      : this.selectedSignalIds.filter((id) => id !== signalId);
    this.selectionChange.emit(next);
  }

  private loadGroups(): void {
    this.loading.set(true);
    this.machinesApi.list({ ...LIST_ALL, companyId: this.companyId }).subscribe({
      next: (machinesResponse) => {
        if (machinesResponse.data.length === 0) {
          this.groups.set([]);
          this.loading.set(false);
          this.catalogChange.emit([]);
          return;
        }
        forkJoin(
          machinesResponse.data.map((machine) =>
            this.signalsApi.list(machine.id, LIST_ALL).pipe(
              map((signalsResponse) => ({
                machineId: machine.id,
                machineName: machine.name,
                signals: signalsResponse.data.map((signal) => ({
                  id: signal.id,
                  name: signal.name,
                  unit: signal.unit,
                })),
              })),
              catchError(() =>
                of({ machineId: machine.id, machineName: machine.name, signals: [] }),
              ),
            ),
          ),
        ).subscribe((groups) => {
          const nonEmptyGroups = groups.filter((group) => group.signals.length > 0);
          this.groups.set(nonEmptyGroups);
          this.loading.set(false);
          this.catalogChange.emit(
            nonEmptyGroups.flatMap((group) =>
              group.signals.map((signal) => ({
                machineId: group.machineId,
                machineName: group.machineName,
                signalId: signal.id,
                signalName: signal.name,
                unit: signal.unit,
              })),
            ),
          );
        });
      },
      error: () => {
        this.groups.set([]);
        this.loading.set(false);
      },
    });
  }
}
