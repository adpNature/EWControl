import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { VariableCategoriesApiService } from '../../adapters/variable-categories-api.service';
import {
  OpcUaNodeMapping,
  OpcUaVariableInUse,
  OpcUaVariableSyncResult,
  RemovedOpcUaVariable,
  SkippedOpcUaVariable,
  SyncedVariableStatus,
  isOpcUaConnectionConfig,
} from '../../entities/machine-connection.model';
import {
  ROW_ERROR_MESSAGES,
  StatusFilter,
  VariableRow,
  buildSaveRequest,
  displayPath,
  filterRows,
  markRowsSaved,
  parseVariablesInUse,
  plcTypeLabel,
  saveErrorMessage,
  skippedReasonText,
  summaryChangesText,
  summaryCountsText,
  summaryTypesText,
  syncErrorMessage,
  toVariableRows,
  typeFilterOptions,
  usageText,
  validateRows,
} from '../../use-cases/opc-ua-variable-sync';
import {
  CatalogIndex,
  categoryFilterGroups,
  indexCatalog,
  matchesCategoryFilter,
} from '../../use-cases/variable-categories';
import { VariableCategory } from '../../entities/variable-category.model';

/** Longitud máxima de una etiqueta (spec 21); las descripciones del CSV pueden ser más largas. */
const MAX_LABEL_LENGTH = 120;

const STATUS_LABELS: Record<SyncedVariableStatus, string> = {
  unchanged: 'Guardada',
  new: 'Nueva',
  typeChanged: 'Tipo cambiado',
};
/** Modificador de la clase global `.status-chip` (kebab-case, regla 12.4). */
const STATUS_CHIP_CLASSES: Record<SyncedVariableStatus, string> = {
  unchanged: 'status-chip status-chip--saved',
  new: 'status-chip status-chip--new',
  typeChanged: 'status-chip status-chip--type-changed',
};

/**
 * docs/specs/21-sincronizacion-variables-opc-ua.md: lista las variables de una
 * carpeta del servidor OPC UA de la Machine, permite darles identificador y
 * etiqueta, guardarlas en el `nodeMapping` y avisa de los cambios respecto a lo
 * guardado en cada sincronización. docs/specs/23-categorias-variables-plc.md
 * añade la categoría de cada variable, su filtro y la etiqueta propuesta desde
 * la descripción del CSV.
 */
@Component({
  selector: 'app-machine-opcua-variables-page',
  standalone: true,
  imports: [ConfirmDialogComponent],
  templateUrl: './machine-opcua-variables-page.html',
  styleUrl: './machine-opcua-variables-page.scss',
})
export class MachineOpcUaVariablesPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly machinesApi = inject(MachinesApiService);
  private readonly toastService = inject(ToastService);
  private readonly categoriesApi = inject(VariableCategoriesApiService);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;
  readonly statusLabels = STATUS_LABELS;
  readonly statusChipClasses = STATUS_CHIP_CLASSES;
  readonly plcTypeLabel = plcTypeLabel;
  readonly skippedReasonText = skippedReasonText;
  readonly displayPath = displayPath;

  readonly loading = signal(true);
  readonly rootNodeId = signal('');
  readonly syncing = signal(false);
  readonly saving = signal(false);
  readonly confirmOpen = signal(false);
  readonly syncError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);

  /** Resultado de la última sincronización: carpeta, omitidas y desglose por tipo. */
  readonly result = signal<OpcUaVariableSyncResult | null>(null);
  readonly rows = signal<VariableRow[]>([]);
  readonly removed = signal<RemovedOpcUaVariable[]>([]);
  readonly removeChecked = signal<ReadonlySet<string>>(new Set());
  readonly inUse = signal<ReadonlyMap<string, OpcUaVariableInUse>>(new Map());
  private readonly mapping = signal<OpcUaNodeMapping[]>([]);

  readonly statusFilter = signal<StatusFilter>('all');
  readonly typeFilter = signal('');
  readonly textFilter = signal('');
  /** spec 23: `''` = todas, `'none'` = sin categoría, o el `id` de una categoría. */
  readonly categoryFilter = signal('');
  readonly categories = signal<VariableCategory[]>([]);
  private readonly catalog = signal<CatalogIndex>(indexCatalog({ categories: [], variables: [] }));
  readonly categoryGroups = computed(() => categoryFilterGroups(this.categories()));

  readonly visibleRows = computed(() => {
    const catalog = this.catalog();
    const category = this.categoryFilter();
    return filterRows(this.rows(), {
      status: this.statusFilter(),
      dataType: this.typeFilter(),
      text: this.textFilter(),
    }).filter((row) => matchesCategoryFilter(catalog, row.nodeId, category));
  });

  /** Identificadores del resto del mapeo (otras carpetas o eliminadas que se conservan). */
  private readonly otherNames = computed(() => {
    const listed = new Set(this.rows().map((row) => row.nodeId));
    const removing = this.removeChecked();
    return this.mapping()
      .filter((entry) => !listed.has(entry.nodeId) && !removing.has(entry.nodeId))
      .map((entry) => entry.signalVariableName);
  });

  readonly rowErrors = computed(() => validateRows(this.rows(), this.otherNames()));

  /** Resumen vivo: refleja lo guardado sin volver a sincronizar. */
  readonly summary = computed(() => {
    const result = this.result();
    if (!result) {
      return null;
    }
    const rows = this.rows();
    const live = {
      ...result.summary,
      total: rows.length,
      new: rows.filter((row) => row.status === 'new').length,
      typeChanged: rows.filter((row) => row.status === 'typeChanged').length,
      removed: this.removed().length,
    };
    return {
      changes: summaryChangesText(live),
      counts: summaryCountsText(live),
      types: summaryTypesText(result.summary.byDataType),
      hasChanges: live.new + live.typeChanged + live.removed > 0,
    };
  });

  readonly typeOptions = computed(() => typeFilterOptions(this.result()?.summary.byDataType ?? {}));

  readonly skipped = computed<SkippedOpcUaVariable[]>(() => this.result()?.skipped ?? []);

  ngOnInit(): void {
    this.categoriesApi.list(this.machineId).subscribe({
      next: (list) => {
        this.categories.set(list.categories);
        this.catalog.set(indexCatalog(list));
        this.rows.update((rows) => this.withProposedLabels(rows));
      },
      error: () => undefined,
    });
    this.machinesApi.getConnection(this.machineId).subscribe({
      next: (connection) => {
        this.loading.set(false);
        const config = connection.connectionConfig;
        if (isOpcUaConnectionConfig(config)) {
          this.mapping.set(config.nodeMapping);
          this.rootNodeId.set(config.variableSyncRootNodeId ?? '');
        }
      },
      error: () => {
        this.loading.set(false);
        this.toastService.show({
          type: 'danger',
          message: 'No se ha podido cargar la conexión de la Machine.',
        });
      },
    });
  }

  setRootNodeId(event: Event): void {
    this.rootNodeId.set((event.target as HTMLInputElement).value);
  }

  canSync(): boolean {
    return this.rootNodeId().trim() !== '' && !this.syncing() && !this.saving();
  }

  sync(): void {
    if (!this.canSync()) {
      return;
    }
    this.syncing.set(true);
    this.syncError.set(null);
    this.machinesApi.syncOpcUaVariables(this.machineId, this.rootNodeId().trim()).subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.result.set(result);
        this.rows.set(this.withProposedLabels(toVariableRows(result)));
        this.removed.set(result.removed);
        this.removeChecked.set(new Set());
        this.inUse.set(new Map());
        this.saveError.set(null);
      },
      error: (error: ApiError) => {
        this.syncing.set(false);
        this.syncError.set(syncErrorMessage(error));
      },
    });
  }

  setStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  setTypeFilter(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value);
  }

  setCategoryFilter(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
  }

  /** spec 23, criterio frontend 4: «Categoría › Subcategoría» o `null`. */
  categoryOf(row: VariableRow): string | null {
    return this.catalog().pathFor(row.nodeId);
  }

  /** spec 23, criterio frontend 5: las filas sin etiqueta proponen la descripción del CSV. */
  private withProposedLabels(rows: VariableRow[]): VariableRow[] {
    const catalog = this.catalog();
    return rows.map((row) => {
      const comment = row.label === '' ? catalog.commentFor(row.nodeId) : null;
      return comment ? { ...row, label: comment.slice(0, MAX_LABEL_LENGTH) } : row;
    });
  }

  setTextFilter(event: Event): void {
    this.textFilter.set((event.target as HTMLInputElement).value);
  }

  editRow(nodeId: string, field: 'signalVariableName' | 'label', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.rows.update((rows) =>
      rows.map((row) => (row.nodeId === nodeId ? { ...row, [field]: value } : row)),
    );
  }

  toggleRemove(nodeId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.removeChecked.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(nodeId);
      } else {
        next.delete(nodeId);
      }
      return next;
    });
  }

  rowError(row: VariableRow): string | null {
    const error = this.rowErrors().get(row.nodeId);
    return error ? ROW_ERROR_MESSAGES[error] : null;
  }

  usageFor(signalVariableName: string | null): string | null {
    const variable = signalVariableName ? this.inUse().get(signalVariableName) : undefined;
    return variable ? usageText(variable) : null;
  }

  confirmMessage(): string {
    const removing = this.removeChecked().size;
    return (
      `Se guardarán ${this.rows().length} variables en la Machine y se reiniciará su lectura ` +
      `en tiempo real.${removing > 0 ? ` Se quitarán ${removing}.` : ''}`
    );
  }

  /** spec 21, criterio frontend 6: valida, y si todo es correcto pide confirmación. */
  requestSave(): void {
    if (this.saving()) {
      return;
    }
    if (this.rowErrors().size > 0) {
      this.statusFilter.set('all');
      this.typeFilter.set('');
      this.textFilter.set('');
      this.categoryFilter.set('');
      return;
    }
    this.confirmOpen.set(true);
  }

  save(): void {
    const result = this.result();
    if (!result) {
      return;
    }
    this.confirmOpen.set(false);
    this.saving.set(true);
    this.saveError.set(null);
    const remove = [...this.removeChecked()];
    this.machinesApi
      .saveOpcUaVariables(this.machineId, buildSaveRequest(result.rootNodeId, this.rows(), remove))
      .subscribe({
        next: (connection) => {
          this.saving.set(false);
          const config = connection.connectionConfig;
          if (config && isOpcUaConnectionConfig(config)) {
            this.mapping.set(config.nodeMapping);
          }
          this.rows.update((rows) => markRowsSaved(rows));
          this.removed.update((removed) =>
            removed.filter((entry) => !remove.includes(entry.nodeId)),
          );
          this.removeChecked.set(new Set());
          this.inUse.set(new Map());
          this.toastService.show({ type: 'success', message: 'Variables guardadas.' });
        },
        error: (error: ApiError) => {
          this.saving.set(false);
          this.inUse.set(
            new Map(
              parseVariablesInUse(error).map((variable) => [variable.signalVariableName, variable]),
            ),
          );
          this.saveError.set(saveErrorMessage(error));
        },
      });
  }
}
