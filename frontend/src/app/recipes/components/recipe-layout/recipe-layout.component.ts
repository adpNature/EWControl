import { NgTemplateOutlet } from '@angular/common';
import { Component, Input, TemplateRef } from '@angular/core';
import { RecipeLayout, RecipeLayoutItem } from '../../entities/recipe-template.model';
import { RecipeVariable } from '../../entities/recipe.model';

export type RecipeLayoutDevice = 'mobile' | 'tablet' | 'desktop';

type RenderedItem =
  | { kind: 'title' | 'text'; span: number; text: string }
  | { kind: 'spacer'; span: number }
  | { kind: 'variable'; span: number; variable: RecipeVariable };

/**
 * Pinta el formulario de recetas según la disposición de la receta base
 * (docs/specs/26-receta-base.md, "Disposición"): filas de 12 columnas con
 * títulos, textos, huecos y variables. El control de cada variable lo pone la
 * página con `fieldTemplate`, así el formulario real y la vista previa se ven
 * igual. Por debajo de `md` todo ocupa el 100 %; en `md`, lo que ocupa hasta
 * el 50 % se queda en el 50 %; desde `lg`, el ancho configurado. `device`
 * fuerza uno de esos anchos (vista previa) sin depender de la pantalla.
 */
@Component({
  selector: 'app-recipe-layout',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './recipe-layout.component.html',
  styleUrl: './recipe-layout.component.scss',
})
export class RecipeLayoutComponent {
  @Input({ required: true }) variables: RecipeVariable[] = [];
  /** Sin disposición, una variable por fila en el orden recibido. */
  @Input() layout: RecipeLayout | null | undefined = null;
  @Input({ required: true }) fieldTemplate!: TemplateRef<{ $implicit: RecipeVariable }>;
  @Input() device: RecipeLayoutDevice | null = null;

  get rows(): RenderedItem[][] {
    const byName = new Map(
      this.variables.map((variable) => [variable.signalVariableName, variable]),
    );
    const layout = this.layout?.rows.length
      ? this.layout
      : {
          rows: this.variables.map((variable) => ({
            items: [
              {
                type: 'VARIABLE' as const,
                span: 12,
                signalVariableName: variable.signalVariableName,
              },
            ],
          })),
        };
    return layout.rows
      .map((row) =>
        row.items
          .map((item) => render(item, byName))
          .filter((item): item is RenderedItem => item !== null),
      )
      .filter((items) => items.some((item) => item.kind !== 'spacer'));
  }

  isHalfOrLess(span: number): boolean {
    return span <= 6;
  }
}

function render(item: RecipeLayoutItem, byName: Map<string, RecipeVariable>): RenderedItem | null {
  if (item.type === 'VARIABLE') {
    const variable = byName.get(item.signalVariableName ?? '');
    return variable ? { kind: 'variable', span: item.span, variable } : null;
  }
  if (item.type === 'SPACER') {
    return { kind: 'spacer', span: item.span };
  }
  return {
    kind: item.type === 'TITLE' ? 'title' : 'text',
    span: item.span,
    text: item.text ?? '',
  };
}
