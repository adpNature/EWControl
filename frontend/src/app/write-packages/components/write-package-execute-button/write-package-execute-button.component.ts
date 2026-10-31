import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { ApiError } from '../../../core/http/api-error.model';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { WritePackagesApiService } from '../../adapters/write-packages-api.service';
import { WritePackage, WritePackageExecution } from '../../entities/write-package.model';
import {
  executionReasonLabel,
  executionStatusLabel,
  formatWriteValue,
  statusCodeLabel,
  writePackageErrorMessage,
} from '../../use-cases/write-package-rules';

let nextId = 0;

/**
 * docs/specs/20-paquetes-escritura-opc-ua.md, criterios de aceptación frontend
 * 3, 4 y 6: botón "Ejecutar" con confirmación que muestra las variables y
 * valores exactos, sin doble envío, y el resultado por variable. Lo comparten
 * la página "Paquetes" y el widget `PACKAGE` del Dashboard. Angular Component
 * (docs/12-convenciones-frontend.md, 12.4): tiene estado (confirmación, en
 * curso, último resultado).
 */
@Component({
  selector: 'app-write-package-execute-button',
  standalone: true,
  imports: [ConfirmDialogComponent],
  templateUrl: './write-package-execute-button.component.html',
  styleUrl: './write-package-execute-button.component.scss',
})
export class WritePackageExecuteButtonComponent {
  @Input({ required: true }) machineId!: string;
  @Input({ required: true }) writePackage!: WritePackage;
  /** Si se indica, "Ejecutar" queda deshabilitado mostrando este motivo (Machine desconectada...). */
  @Input() disabledReason: string | null = null;

  @Output() executed = new EventEmitter<WritePackageExecution>();

  private readonly api = inject(WritePackagesApiService);
  readonly reasonId = `write-package-execute-reason-${nextId++}`;

  readonly confirmOpen = signal(false);
  readonly executing = signal(false);
  readonly result = signal<WritePackageExecution | null>(null);
  readonly error = signal<string | null>(null);

  readonly formatValue = formatWriteValue;
  readonly statusLabel = executionStatusLabel;
  readonly statusCodeLabel = statusCodeLabel;
  readonly reasonLabel = executionReasonLabel;

  askConfirmation(): void {
    if (!this.disabledReason && !this.executing()) {
      this.confirmOpen.set(true);
    }
  }

  confirm(): void {
    this.confirmOpen.set(false);
    if (this.executing()) {
      return;
    }
    this.executing.set(true);
    this.error.set(null);
    this.result.set(null);
    this.api.execute(this.machineId, this.writePackage.id).subscribe({
      next: (execution) => {
        this.executing.set(false);
        this.result.set(execution);
        this.executed.emit(execution);
      },
      error: (error: ApiError) => {
        this.executing.set(false);
        this.error.set(writePackageErrorMessage(error));
      },
    });
  }
}
