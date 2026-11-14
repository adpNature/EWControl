import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/http/api.service';
import {
  RecipeTemplate,
  RecipeTemplateImpact,
  RecipeTemplateRequest,
} from '../entities/recipe-template.model';

/**
 * Interface Adapter: docs/11-api-rest.md, sección "Recipe" (docs/specs/26-receta-base.md).
 * Solo para `AdminCliente`/`SuperAdmin`.
 */
@Injectable({ providedIn: 'root' })
export class RecipeTemplateApiService {
  private readonly api = inject(ApiService);

  get(machineId: string): Observable<RecipeTemplate> {
    return this.api.get<RecipeTemplate>(this.base(machineId));
  }

  /** `version` es la leída (0 si se partía de la receta base por defecto). */
  save(
    machineId: string,
    request: RecipeTemplateRequest & { version: number },
  ): Observable<RecipeTemplate> {
    return this.api.put<RecipeTemplate>(this.base(machineId), request);
  }

  /** Solo calcula cuántas recetas pasarían a incompletas: no guarda nada. */
  impact(machineId: string, request: RecipeTemplateRequest): Observable<RecipeTemplateImpact> {
    return this.api.post<RecipeTemplateImpact>(`${this.base(machineId)}/impact`, request);
  }

  private base(machineId: string): string {
    return `/machines/${machineId}/recipe-template`;
  }
}
