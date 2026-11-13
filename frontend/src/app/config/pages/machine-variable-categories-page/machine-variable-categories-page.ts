import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiError } from '../../../core/http/api-error.model';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { VariableCategoriesApiService } from '../../adapters/variable-categories-api.service';
import { isOpcUaConnectionConfig } from '../../entities/machine-connection.model';
import { VariableCategory } from '../../entities/variable-category.model';
import {
  buildCategoryTree,
  categoryErrorMessage,
  decodeCsvFile,
  importSummaryText,
} from '../../use-cases/variable-categories';

/**
 * docs/specs/23-categorias-variables-plc.md: importa la exportación CSV de la
 * GVL de una Machine para crear su árbol de categorías y permite renombrarlas.
 */
@Component({
  selector: 'app-machine-variable-categories-page',
  standalone: true,
  imports: [ConfirmDialogComponent, NgTemplateOutlet],
  templateUrl: './machine-variable-categories-page.html',
  styleUrl: './machine-variable-categories-page.scss',
})
export class MachineVariableCategoriesPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly categoriesApi = inject(VariableCategoriesApiService);
  private readonly machinesApi = inject(MachinesApiService);
  private readonly toastService = inject(ToastService);

  readonly machineId = this.route.snapshot.paramMap.get('machineId')!;

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly categories = signal<VariableCategory[]>([]);
  readonly tree = computed(() => buildCategoryTree(this.categories()));

  /** Nombres editados por `id`; solo los que difieren del guardado. */
  readonly drafts = signal<ReadonlyMap<string, string>>(new Map());
  readonly renaming = signal<string | null>(null);
  readonly rowErrors = signal<ReadonlyMap<string, string>>(new Map());

  readonly rootNodeId = signal('');
  readonly file = signal<File | null>(null);
  readonly importing = signal(false);
  readonly importError = signal<string | null>(null);
  readonly confirmOpen = signal(false);

  ngOnInit(): void {
    this.load();
    this.machinesApi.getConnection(this.machineId).subscribe({
      next: (connection) => {
        const config = connection.connectionConfig;
        if (isOpcUaConnectionConfig(config) && config.variableSyncRootNodeId) {
          this.rootNodeId.set(config.variableSyncRootNodeId);
        }
      },
      error: () => undefined,
    });
  }

  private load(): void {
    this.categoriesApi.list(this.machineId).subscribe({
      next: (list) => {
        this.loading.set(false);
        this.loadError.set(null);
        this.categories.set(list.categories);
        this.drafts.set(new Map());
        this.rowErrors.set(new Map());
      },
      error: (error: ApiError) => {
        this.loading.set(false);
        this.loadError.set(categoryErrorMessage(error));
      },
    });
  }

  nameOf(category: VariableCategory): string {
    return this.drafts().get(category.id) ?? category.name;
  }

  variableCountText(category: VariableCategory): string {
    return `${category.variableCount} ${category.variableCount === 1 ? 'variable' : 'variables'}`;
  }

  editName(category: VariableCategory, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.drafts.update((drafts) => {
      const next = new Map(drafts);
      if (value === category.name) {
        next.delete(category.id);
      } else {
        next.set(category.id, value);
      }
      return next;
    });
  }

  canSaveName(category: VariableCategory): boolean {
    const draft = this.drafts().get(category.id);
    return draft !== undefined && draft.trim() !== '' && this.renaming() === null;
  }

  rowError(category: VariableCategory): string | null {
    return this.rowErrors().get(category.id) ?? null;
  }

  /** spec 23, criterio frontend 2. */
  saveName(category: VariableCategory): void {
    const name = this.drafts().get(category.id);
    if (name === undefined || !this.canSaveName(category)) {
      return;
    }
    this.renaming.set(category.id);
    this.categoriesApi.rename(this.machineId, category.id, name).subscribe({
      next: (renamed) => {
        this.renaming.set(null);
        this.categories.update((categories) =>
          categories.map((item) =>
            item.id === renamed.id ? { ...item, name: renamed.name } : item,
          ),
        );
        this.forget(category.id);
        this.toastService.show({ type: 'success', message: 'Categoría renombrada.' });
      },
      error: (error: ApiError) => {
        this.renaming.set(null);
        this.rowErrors.update((errors) =>
          new Map(errors).set(category.id, categoryErrorMessage(error)),
        );
      },
    });
  }

  private forget(categoryId: string): void {
    this.drafts.update((drafts) => {
      const next = new Map(drafts);
      next.delete(categoryId);
      return next;
    });
    this.rowErrors.update((errors) => {
      const next = new Map(errors);
      next.delete(categoryId);
      return next;
    });
  }

  setRootNodeId(event: Event): void {
    this.rootNodeId.set((event.target as HTMLInputElement).value);
  }

  setFile(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
    this.importError.set(null);
  }

  canImport(): boolean {
    return this.file() !== null && this.rootNodeId().trim() !== '' && !this.importing();
  }

  /** spec 23, criterio frontend 1: con categorías existentes, pide confirmación. */
  requestImport(): void {
    if (!this.canImport()) {
      return;
    }
    if (this.categories().length > 0) {
      this.confirmOpen.set(true);
      return;
    }
    void this.import();
  }

  async import(): Promise<void> {
    const file = this.file();
    if (!file) {
      return;
    }
    this.confirmOpen.set(false);
    this.importing.set(true);
    this.importError.set(null);
    const csv = decodeCsvFile(await file.arrayBuffer());
    this.categoriesApi
      .import(this.machineId, { rootNodeId: this.rootNodeId().trim(), csv })
      .subscribe({
        next: (summary) => {
          this.importing.set(false);
          this.toastService.show({
            type: 'success',
            message: `Importadas ${importSummaryText(summary)}`,
          });
          this.load();
        },
        error: (error: ApiError) => {
          this.importing.set(false);
          this.importError.set(categoryErrorMessage(error));
        },
      });
  }
}
