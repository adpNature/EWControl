import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { Machine } from '../../entities/machine.model';
import { Signal } from '../../entities/signal.model';
import { canConfigure } from '../../use-cases/config-permissions';
import { MachinesState } from '../../use-cases/machines.state';
import { SignalsState } from '../../use-cases/signals.state';

const SIGNAL_COLUMNS: TableColumn<Signal>[] = [
  { key: 'name', header: 'Nombre' },
  { key: 'signalType', header: 'Tipo' },
  { key: 'unit', header: 'Unidad' },
];

/**
 * docs/specs/06-gestion-machines-signals.md: detalle de una Machine, con sus
 * Signals. El borrado de la Machine advierte explícitamente la cascada sobre
 * sus Signals (criterio de aceptación frontend 4).
 */
@Component({
  selector: 'app-machine-detail-page',
  standalone: true,
  imports: [RouterLink, TableComponent, ConfirmDialogComponent],
  templateUrl: './machine-detail-page.html',
  styleUrl: './machine-detail-page.scss',
})
export class MachineDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  private readonly machinesApi = inject(MachinesApiService);
  private readonly machinesState = inject(MachinesState);
  protected readonly signalsState = inject(SignalsState);
  private readonly toastService = inject(ToastService);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;

  readonly machine = signal<Machine | null>(null);
  readonly signalColumns = SIGNAL_COLUMNS;
  readonly signalRowKey = (signal: Signal): string => signal.id;

  readonly deleteMachineDialogOpen = signal(false);
  readonly signalToDelete = signal<Signal | null>(null);

  ngOnInit(): void {
    const fromState = this.machinesState
      .machines()
      .find((machine) => machine.id === this.machineId);
    if (fromState) {
      this.machine.set(fromState);
    } else {
      this.machinesApi.get(this.machineId).subscribe((machine) => this.machine.set(machine));
    }
    this.signalsState.load(this.machineId).subscribe();
  }

  canConfigure(): boolean {
    return canConfigure(this.authState.currentUser()?.role);
  }

  confirmDeleteMachine(): void {
    this.deleteMachineDialogOpen.set(false);
    this.machinesState.remove(this.machineId).subscribe({
      next: () => {
        this.toastService.show({ type: 'success', message: 'Machine eliminada.' });
        this.router.navigate(['/config/machines']);
      },
      error: () => {
        this.toastService.show({
          type: 'danger',
          message: 'No se ha podido eliminar la Machine.',
        });
      },
    });
  }

  confirmDeleteSignal(): void {
    const signal = this.signalToDelete();
    this.signalToDelete.set(null);
    if (!signal) {
      return;
    }
    this.signalsState.remove(this.machineId, signal.id).subscribe({
      next: () => this.toastService.show({ type: 'success', message: 'Signal eliminada.' }),
      error: () =>
        this.toastService.show({ type: 'danger', message: 'No se ha podido eliminar la Signal.' }),
    });
  }
}
