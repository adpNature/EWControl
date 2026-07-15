import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MachinesApiService } from '../../../config/adapters/machines-api.service';
import { SignalsApiService } from '../../../config/adapters/signals-api.service';
import { Machine } from '../../../config/entities/machine.model';
import { Signal } from '../../../config/entities/signal.model';
import { WidgetType } from '../../entities/dashboard.model';
import { WidgetConfig } from '../../entities/widget-config.model';
import { DashboardState } from '../../use-cases/dashboard.state';
import { AlarmListWidgetComponent } from '../../widgets/alarm-list/alarm-list-widget.component';
import { ChartWidgetComponent } from '../../widgets/chart/chart-widget.component';
import { GaugeWidgetComponent } from '../../widgets/gauge/gauge-widget.component';
import { TableWidgetComponent } from '../../widgets/table/table-widget.component';
import { ValueWidgetComponent } from '../../widgets/value/value-widget.component';

const WIDGET_TYPES: WidgetType[] = ['VALUE', 'GAUGE', 'CHART', 'TABLE', 'ALARM_LIST'];

/**
 * Dashboard en tiempo real (docs/specs/07-dashboard-tiempo-real.md): recorre
 * dinámicamente los widgets del Dashboard activo (Documento 8, apartado 8.3),
 * sin pantallas codificadas por Machine o Company. La cabecera de sesión
 * (email, cambiar contraseña, logout) vive en el shell (docs/specs/12-navegacion-shell.md),
 * no en esta página.
 */
@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ValueWidgetComponent,
    GaugeWidgetComponent,
    ChartWidgetComponent,
    TableWidgetComponent,
    AlarmListWidgetComponent,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage implements OnInit {
  private readonly machinesApi = inject(MachinesApiService);
  private readonly signalsApi = inject(SignalsApiService);
  protected readonly dashboardState = inject(DashboardState);

  readonly widgetTypes = WIDGET_TYPES;

  readonly newDashboardForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly showAddWidgetForm = signal(false);
  readonly machines = signal<Machine[]>([]);
  readonly signalsOfSelectedMachine = signal<Signal[]>([]);
  readonly addWidgetError = signal<string | null>(null);

  readonly addWidgetForm = new FormGroup({
    widgetType: new FormControl<WidgetType>('VALUE', { nonNullable: true }),
    machineId: new FormControl('', { nonNullable: true }),
    signalIds: new FormControl<string[]>([], { nonNullable: true }),
    gaugeMin: new FormControl(0, { nonNullable: true }),
    gaugeMax: new FormControl(100, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.dashboardState.loadDashboards().subscribe((dashboards) => {
      if (dashboards.length > 0) {
        this.dashboardState.open(dashboards[0].id).subscribe();
      }
    });
  }

  createDashboard(): void {
    if (this.newDashboardForm.invalid) {
      this.newDashboardForm.markAllAsTouched();
      return;
    }
    this.dashboardState
      .createDashboard(this.newDashboardForm.getRawValue())
      .subscribe((dashboard) => this.dashboardState.open(dashboard.id).subscribe());
  }

  toggleAddWidgetForm(): void {
    this.showAddWidgetForm.update((current) => !current);
    if (this.showAddWidgetForm() && this.machines().length === 0) {
      this.machinesApi
        .list({ limit: 100, offset: 0 })
        .subscribe((response) => this.machines.set(response.data));
    }
  }

  onMachineChange(machineId: string): void {
    this.addWidgetForm.patchValue({ machineId, signalIds: [] });
    if (!machineId) {
      this.signalsOfSelectedMachine.set([]);
      return;
    }
    this.signalsApi
      .list(machineId, { limit: 100, offset: 0 })
      .subscribe((response) => this.signalsOfSelectedMachine.set(response.data));
  }

  toggleSignal(signalId: string, checked: boolean): void {
    const current = this.addWidgetForm.controls.signalIds.value;
    const widgetType = this.addWidgetForm.controls.widgetType.value;
    const next = checked
      ? widgetType === 'TABLE'
        ? [...current, signalId]
        : [signalId]
      : current.filter((id) => id !== signalId);
    this.addWidgetForm.controls.signalIds.setValue(next);
  }

  isSignalSelected(signalId: string): boolean {
    return this.addWidgetForm.controls.signalIds.value.includes(signalId);
  }

  submitAddWidget(): void {
    const dashboard = this.dashboardState.activeDashboard();
    if (!dashboard) {
      return;
    }
    const { widgetType, signalIds, gaugeMin, gaugeMax } = this.addWidgetForm.getRawValue();
    if (widgetType !== 'ALARM_LIST' && signalIds.length === 0) {
      this.addWidgetError.set('Selecciona al menos una Signal.');
      return;
    }

    const config: WidgetConfig = widgetType === 'GAUGE' ? { min: gaugeMin, max: gaugeMax } : {};

    this.dashboardState
      .addWidget(dashboard.id, {
        widgetType,
        signalIds,
        config,
        position: dashboard.widgets.length,
      })
      .subscribe({
        next: () => {
          this.showAddWidgetForm.set(false);
          this.addWidgetError.set(null);
          this.addWidgetForm.reset({
            widgetType: 'VALUE',
            machineId: '',
            signalIds: [],
            gaugeMin: 0,
            gaugeMax: 100,
          });
        },
        error: () => this.addWidgetError.set('No se ha podido añadir el widget.'),
      });
  }
}
