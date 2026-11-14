import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import { PaginatedResponse } from '../../core/http/paginated-response.model';
import { Recipe, RecipeRequest, RecipeSummary, RecipeVariableSet } from '../entities/recipe.model';

/** Interface Adapter: docs/11-api-rest.md, sección "Recipes" (docs/specs/25-recetas.md). */
@Injectable({ providedIn: 'root' })
export class RecipesApiService {
  private readonly api = inject(ApiService);

  variables(machineId: string): Observable<RecipeVariableSet> {
    return this.api.get<RecipeVariableSet>(`/machines/${machineId}/recipe-variables`);
  }

  list(
    machineId: string,
    params: { search?: string; limit: number; offset: number },
  ): Observable<PaginatedResponse<RecipeSummary>> {
    const query: Record<string, string | number> = { limit: params.limit, offset: params.offset };
    if (params.search) {
      query['search'] = params.search;
    }
    return this.api.get<PaginatedResponse<RecipeSummary>>(this.base(machineId), query);
  }

  get(machineId: string, recipeId: string): Observable<Recipe> {
    return this.api.get<Recipe>(`${this.base(machineId)}/${recipeId}`);
  }

  create(machineId: string, request: RecipeRequest): Observable<Recipe> {
    return this.api.post<Recipe>(this.base(machineId), request);
  }

  update(
    machineId: string,
    recipeId: string,
    request: RecipeRequest & { version: number },
  ): Observable<Recipe> {
    return this.api.put<Recipe>(`${this.base(machineId)}/${recipeId}`, request);
  }

  remove(machineId: string, recipeId: string): Observable<void> {
    return this.api.delete<void>(`${this.base(machineId)}/${recipeId}`);
  }

  /** Solo marca la receta: no se envía nada a la máquina (spec 25). */
  activate(machineId: string, recipeId: string): Observable<Recipe> {
    return this.api.post<Recipe>(`${this.base(machineId)}/${recipeId}/activate`, {});
  }

  deactivate(machineId: string, recipeId: string): Observable<Recipe> {
    return this.api.post<Recipe>(`${this.base(machineId)}/${recipeId}/deactivate`, {});
  }

  private base(machineId: string): string {
    return `/machines/${machineId}/recipes`;
  }
}
