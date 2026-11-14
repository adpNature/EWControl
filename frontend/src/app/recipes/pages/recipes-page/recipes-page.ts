import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../../auth/use-cases/auth.state';
import { MachinesApiService } from '../../../config/adapters/machines-api.service';
import { Machine } from '../../../config/entities/machine.model';
import { canConfigure } from '../../../config/use-cases/config-permissions';
import { ApiError } from '../../../core/http/api-error.model';
import { LocalStorageService } from '../../../core/storage/local-storage.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog/confirm-dialog.component';
import { TableColumn, TableComponent } from '../../../shared/ui/table/table.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { RecipesApiService } from '../../adapters/recipes-api.service';
import { RecipeSummary, RecipeVariableSet } from '../../entities/recipe.model';
import {
  RECIPE_CATEGORY_NAME,
  recipeErrorMessage,
  recipeStatusLabel,
} from '../../use-cases/recipe-rules';

export const PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;
export const SELECTED_MACHINE_KEY = 'ewcontrol.recipes.machineId';

type PendingAction =
  | { kind: 'activate'; recipe: RecipeSummary; previous: RecipeSummary }
  | { kind: 'delete'; recipe: RecipeSummary };

/**
 * docs/specs/25-recetas.md, "Listado y buscador": recetas de una Machine para
 * los tres roles, con buscador, paginación y las acciones de editar, duplicar,
 * activar/desactivar y eliminar. Activar es solo una marca: no se envía nada a
 * la máquina.
 */
@Component({
  selector: 'app-recipes-page',
  standalone: true,
  imports: [RouterLink, TableComponent, ConfirmDialogComponent],
  providers: [DatePipe],
  templateUrl: './recipes-page.html',
  styleUrl: './recipes-page.scss',
})
export class RecipesPage implements OnInit, OnDestroy {
  private readonly machinesApi = inject(MachinesApiService);
  private readonly recipesApi = inject(RecipesApiService);
  private readonly storage = inject(LocalStorageService);
  private readonly toasts = inject(ToastService);
  private readonly authState = inject(AuthStateService);
  private readonly datePipe = inject(DatePipe);

  readonly categoryName = RECIPE_CATEGORY_NAME;
  readonly machines = signal<Machine[]>([]);
  readonly selectedMachineId = signal('');
  readonly variableSet = signal<RecipeVariableSet | null>(null);
  readonly recipes = signal<RecipeSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly search = signal('');
  /** Búsqueda ya aplicada a la tabla (tras el debounce). */
  readonly appliedSearch = signal('');
  readonly activeRecipe = signal<RecipeSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingAction = signal<PendingAction | null>(null);

  readonly isAdmin = computed(() => canConfigure(this.authState.currentUser()?.role));
  readonly canCreate = computed(() => (this.variableSet()?.variables.length ?? 0) > 0);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly emptyMessage = computed(() =>
    this.appliedSearch()
      ? `Sin resultados para "${this.appliedSearch()}"`
      : 'Esta máquina no tiene recetas.',
  );

  readonly columns: TableColumn<RecipeSummary>[] = [
    { key: 'title', header: 'Título' },
    { key: 'description', header: 'Descripción', cell: (recipe) => recipe.description ?? '' },
    { key: 'status', header: 'Estado', cell: (recipe) => recipeStatusLabel(recipe) },
    {
      key: 'updatedAt',
      header: 'Última modificación',
      cell: (recipe) =>
        `${this.datePipe.transform(recipe.updatedAt, 'short') ?? ''} · ${recipe.updatedByEmail}`,
    },
  ];

  readonly rowKey = (recipe: RecipeSummary) => recipe.id;

  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.machinesApi.list({ limit: 100, offset: 0 }).subscribe((response) => {
      this.machines.set(response.data);
      const remembered = this.storage.getItem(SELECTED_MACHINE_KEY);
      const initial =
        response.data.find((machine) => machine.id === remembered) ?? response.data[0];
      if (initial) {
        this.selectMachine(initial.id);
      }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
  }

  selectMachine(machineId: string): void {
    this.selectedMachineId.set(machineId);
    this.variableSet.set(null);
    this.recipes.set([]);
    this.total.set(0);
    this.activeRecipe.set(null);
    this.page.set(0);
    this.search.set('');
    this.appliedSearch.set('');
    this.error.set(null);
    if (!machineId) {
      return;
    }
    this.storage.setItem(SELECTED_MACHINE_KEY, machineId);
    this.recipesApi.variables(machineId).subscribe({
      next: (variableSet) => this.variableSet.set(variableSet),
      error: (error: ApiError) => this.error.set(recipeErrorMessage(error)),
    });
    this.reload();
  }

  onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.appliedSearch.set(this.search().trim());
      this.page.set(0);
      this.loadPage();
    }, SEARCH_DEBOUNCE_MS);
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.loadPage();
  }

  requestActivate(recipe: RecipeSummary): void {
    const previous = this.activeRecipe();
    if (previous && previous.id !== recipe.id) {
      this.pendingAction.set({ kind: 'activate', recipe, previous });
      return;
    }
    this.activate(recipe);
  }

  deactivate(recipe: RecipeSummary): void {
    this.recipesApi.deactivate(this.selectedMachineId(), recipe.id).subscribe({
      next: () => {
        this.toasts.show({ type: 'success', message: `"${recipe.title}" ya no está activa.` });
        this.reload();
      },
      error: (error: ApiError) => this.showError(error),
    });
  }

  requestDelete(recipe: RecipeSummary): void {
    this.pendingAction.set({ kind: 'delete', recipe });
  }

  dialogTitle(action: PendingAction): string {
    return action.kind === 'activate' ? 'Activar receta' : 'Eliminar receta';
  }

  dialogMessage(action: PendingAction): string {
    if (action.kind === 'activate') {
      return `La receta "${action.previous.title}" dejará de estar activa.`;
    }
    const base = `Se eliminará la receta "${action.recipe.title}". No se puede deshacer.`;
    return action.recipe.isActivated
      ? `${base} Es la receta activa: la máquina se quedará sin receta activa.`
      : base;
  }

  confirmPendingAction(): void {
    const action = this.pendingAction();
    this.pendingAction.set(null);
    if (!action) {
      return;
    }
    if (action.kind === 'activate') {
      this.activate(action.recipe);
      return;
    }
    this.recipesApi.remove(this.selectedMachineId(), action.recipe.id).subscribe({
      next: () => {
        this.toasts.show({
          type: 'success',
          message: `Receta "${action.recipe.title}" eliminada.`,
        });
        this.reload();
      },
      error: (error: ApiError) => this.showError(error),
    });
  }

  cancelPendingAction(): void {
    this.pendingAction.set(null);
  }

  private activate(recipe: RecipeSummary): void {
    this.recipesApi.activate(this.selectedMachineId(), recipe.id).subscribe({
      next: () => {
        this.toasts.show({
          type: 'success',
          message: 'Receta marcada como activa. Por ahora no se envía nada a la máquina.',
        });
        this.reload();
      },
      error: (error: ApiError) => this.showError(error),
    });
  }

  private reload(): void {
    this.loadPage();
    this.loadActive();
  }

  private loadPage(): void {
    const machineId = this.selectedMachineId();
    if (!machineId) {
      return;
    }
    this.loading.set(true);
    this.recipesApi
      .list(machineId, {
        ...(this.appliedSearch() ? { search: this.appliedSearch() } : {}),
        limit: PAGE_SIZE,
        offset: this.page() * PAGE_SIZE,
      })
      .subscribe({
        next: (response) => {
          this.loading.set(false);
          this.recipes.set(response.data);
          this.total.set(response.total);
        },
        error: (error: ApiError) => {
          this.loading.set(false);
          this.error.set(recipeErrorMessage(error));
        },
      });
  }

  /** La activa sale siempre la primera sin búsqueda: así se conoce aunque el filtro la oculte. */
  private loadActive(): void {
    this.recipesApi.list(this.selectedMachineId(), { limit: 1, offset: 0 }).subscribe({
      next: (response) => {
        const first = response.data[0];
        this.activeRecipe.set(first?.isActivated ? first : null);
      },
      error: () => this.activeRecipe.set(null),
    });
  }

  private showError(error: ApiError): void {
    this.toasts.show({ type: 'danger', message: recipeErrorMessage(error) });
  }
}
