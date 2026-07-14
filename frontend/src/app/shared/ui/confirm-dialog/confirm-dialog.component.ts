import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

let nextDialogId = 0;

/**
 * Angular Component con estado (abierto/cerrado) y comportamiento (foco al
 * abrir, cierre por Escape/backdrop) — docs/12-convenciones-frontend.md,
 * apartado 12.4 (tabla ampliada con esta pieza, ver commit de esta spec).
 * `role="alertdialog"` (no `dialog` genérico): es específicamente una
 * confirmación crítica antes de una acción destructiva.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent implements OnChanges {
  @Input({ required: true }) open = false;
  @Input({ required: true }) title!: string;
  @Input({ required: true }) message!: string;
  @Input() confirmLabel = 'Eliminar';
  @Input() cancelLabel = 'Cancelar';
  @Input() danger = true;
  /** Si se indica, exige teclear este texto exacto para habilitar el botón de confirmar (borrados irreversibles, docs/specs/10-gestion-companies-users.md). */
  @Input() confirmText?: string;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('dialog') private readonly dialogRef?: ElementRef<HTMLElement>;

  private readonly dialogId = nextDialogId++;
  readonly titleId = `confirm-dialog-title-${this.dialogId}`;
  readonly messageId = `confirm-dialog-message-${this.dialogId}`;
  readonly confirmInputId = `confirm-dialog-confirm-input-${this.dialogId}`;

  typedValue = '';

  get isConfirmDisabled(): boolean {
    return this.confirmText !== undefined && this.typedValue !== this.confirmText;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.typedValue = '';
      queueMicrotask(() => this.dialogRef?.nativeElement.focus());
    }
  }

  onTypedValueInput(value: string): void {
    this.typedValue = value;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.cancelled.emit();
    }
  }

  onBackdropClick(): void {
    this.cancelled.emit();
  }
}
