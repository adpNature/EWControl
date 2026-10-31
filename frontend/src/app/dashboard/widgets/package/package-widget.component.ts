import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Subscription, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RealtimeSocketService } from '../../../core/websocket/realtime-socket.service';
import { WritePackagesApiService } from '../../../write-packages/adapters/write-packages-api.service';
import { WritePackageExecuteButtonComponent } from '../../../write-packages/components/write-package-execute-button/write-package-execute-button.component';
import {
  WritePackage,
  WritePackageList,
} from '../../../write-packages/entities/write-package.model';
import {
  executionDisabledReason,
  formatWriteValue,
} from '../../../write-packages/use-cases/write-package-rules';
import { DashboardWidget } from '../../entities/dashboard.model';
import { PackageWidgetConfig } from '../../entities/widget-config.model';

/**
 * Widget PACKAGE (docs/specs/20-paquetes-escritura-opc-ua.md): un paquete de
 * escritura ejecutable desde el Dashboard, con la misma confirmación que la
 * página "Paquetes" (`WritePackageExecuteButtonComponent`). El estado de
 * conexión de la Machine llega por REST al cargar y se mantiene con
 * `MachineConnected`/`MachineDisconnected` por WebSocket.
 */
@Component({
  selector: 'app-package-widget',
  standalone: true,
  imports: [WritePackageExecuteButtonComponent],
  templateUrl: './package-widget.component.html',
  styleUrl: './package-widget.component.scss',
})
export class PackageWidgetComponent implements OnInit, OnDestroy {
  @Input({ required: true }) widget!: DashboardWidget;

  private readonly writePackagesApi = inject(WritePackagesApiService);
  private readonly realtimeSocket = inject(RealtimeSocketService);
  private readonly subscriptions = new Subscription();

  readonly list = signal<WritePackageList | null>(null);
  readonly writePackage = signal<WritePackage | null>(null);
  readonly loadError = signal(false);
  readonly formatValue = formatWriteValue;

  get config(): PackageWidgetConfig {
    return this.widget.widgetConfig as PackageWidgetConfig;
  }

  disabledReason(): string | null {
    return executionDisabledReason(this.list());
  }

  ngOnInit(): void {
    const { machineId, writePackageId } = this.config;
    this.writePackagesApi.list(machineId).subscribe({
      next: (list) => {
        this.list.set(list);
        this.writePackage.set(list.packages.find((item) => item.id === writePackageId) ?? null);
      },
      // Degradación aislada, como el resto de widgets: no bloquea el Dashboard.
      error: () => this.loadError.set(true),
    });

    this.subscriptions.add(
      merge(
        this.realtimeSocket.machineConnected$.pipe(map((event) => ({ event, connected: true }))),
        this.realtimeSocket.machineDisconnected$.pipe(
          map((event) => ({ event, connected: false })),
        ),
      )
        .pipe(filter(({ event }) => event.machineId === machineId))
        .subscribe(({ connected }) =>
          this.list.update((list) => (list ? { ...list, connected } : list)),
        ),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
