import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../../core/http/api-error.model';
import { MachinesApiService } from '../../../config/adapters/machines-api.service';
import { Machine } from '../../../config/entities/machine.model';
import { WritePackagesApiService } from '../../adapters/write-packages-api.service';
import { WritePackageExecuteButtonComponent } from '../../components/write-package-execute-button/write-package-execute-button.component';
import {
  WritePackage,
  WritePackageExecution,
  WritePackageList,
} from '../../entities/write-package.model';
import {
  executionDisabledReason,
  executionReasonLabel,
  executionStatusLabel,
  formatWriteValue,
  statusCodeLabel,
  writePackageErrorMessage,
} from '../../use-cases/write-package-rules';

const HISTORY_PAGE_SIZE = 10;

/**
 * docs/specs/20-paquetes-escritura-opc-ua.md, sección "Ejecución (los tres
 * roles)": paquetes activos de una Machine, su ejecución y su historial. Es
 * la pantalla del `Operador` (docs/specs/19-rol-operador.md), sin controles de
 * crear ni editar, que viven en "Configuración".
 */
@Component({
  selector: 'app-write-packages-page',
  standalone: true,
  imports: [DatePipe, WritePackageExecuteButtonComponent],
  templateUrl: './write-packages-page.html',
  styleUrl: './write-packages-page.scss',
})
export class WritePackagesPage implements OnInit {
  private readonly machinesApi = inject(MachinesApiService);
  private readonly writePackagesApi = inject(WritePackagesApiService);

  readonly machines = signal<Machine[]>([]);
  readonly selectedMachineId = signal<string>('');
  readonly list = signal<WritePackageList | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly openHistory = signal<string | null>(null);
  readonly history = signal<WritePackageExecution[]>([]);

  readonly formatValue = formatWriteValue;
  readonly statusLabel = executionStatusLabel;
  readonly statusCodeLabel = statusCodeLabel;
  readonly reasonLabel = executionReasonLabel;

  /** spec 20, criterio frontend 6: por qué no se puede ejecutar ahora, o `null`. */
  readonly disabledReason = computed(() => executionDisabledReason(this.list()));

  ngOnInit(): void {
    this.machinesApi.list({ limit: 100, offset: 0 }).subscribe((response) => {
      this.machines.set(response.data);
      const firstOpcUa = response.data.find((machine) => machine.providerType === 'OpcUa');
      if (firstOpcUa) {
        this.selectMachine(firstOpcUa.id);
      }
    });
  }

  selectMachine(machineId: string): void {
    this.selectedMachineId.set(machineId);
    this.list.set(null);
    this.openHistory.set(null);
    this.error.set(null);
    if (!machineId) {
      return;
    }
    this.loading.set(true);
    this.writePackagesApi.list(machineId).subscribe({
      next: (list) => {
        this.loading.set(false);
        this.list.set(list);
      },
      error: (error: ApiError) => {
        this.loading.set(false);
        this.error.set(writePackageErrorMessage(error));
      },
    });
  }

  toggleHistory(writePackage: WritePackage): void {
    if (this.openHistory() === writePackage.id) {
      this.openHistory.set(null);
      return;
    }
    this.openHistory.set(writePackage.id);
    this.loadHistory(writePackage.id);
  }

  onExecuted(writePackage: WritePackage): void {
    if (this.openHistory() === writePackage.id) {
      this.loadHistory(writePackage.id);
    }
  }

  private loadHistory(packageId: string): void {
    this.history.set([]);
    this.writePackagesApi
      .executions(this.selectedMachineId(), packageId, { limit: HISTORY_PAGE_SIZE, offset: 0 })
      .subscribe((page) => this.history.set(page.data));
  }
}
