import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import {
  ImportVariableCategoriesSummary,
  VariableCategory,
  VariableCategoryList,
} from '../entities/variable-category.model';

/**
 * Interface Adapter: llamadas HTTP de docs/11-api-rest.md, sección «Categorías
 * de variables» (docs/specs/23-categorias-variables-plc.md).
 */
@Injectable({ providedIn: 'root' })
export class VariableCategoriesApiService {
  private readonly api = inject(ApiService);

  list(machineId: string): Observable<VariableCategoryList> {
    return this.api.get<VariableCategoryList>(`/machines/${machineId}/variable-categories`);
  }

  /** Sustituye todas las categorías y el catálogo de la Machine por los del CSV. */
  import(
    machineId: string,
    body: { rootNodeId: string; csv: string },
  ): Observable<ImportVariableCategoriesSummary> {
    return this.api.post<ImportVariableCategoriesSummary>(
      `/machines/${machineId}/variable-categories/import`,
      body,
    );
  }

  rename(machineId: string, categoryId: string, name: string): Observable<VariableCategory> {
    return this.api.patch<VariableCategory>(
      `/machines/${machineId}/variable-categories/${categoryId}`,
      { name },
    );
  }
}
