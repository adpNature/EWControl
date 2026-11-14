import { Component, Input } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { RecipeLayout } from '../../entities/recipe-template.model';
import { RecipeVariable } from '../../entities/recipe.model';
import { RecipeLayoutComponent, RecipeLayoutDevice } from './recipe-layout.component';

function variable(signalVariableName: string): RecipeVariable {
  return { signalVariableName, dataType: 'Float', comment: null, min: null, max: null };
}

@Component({
  standalone: true,
  imports: [RecipeLayoutComponent],
  template: `
    <app-recipe-layout
      [variables]="variables"
      [layout]="layout"
      [device]="device"
      [fieldTemplate]="field"
    />
    <ng-template #field let-variable>
      <span data-testid="field">{{ variable.signalVariableName }}</span>
    </ng-template>
  `,
})
class HostComponent {
  @Input() variables: RecipeVariable[] = [];
  @Input() layout: RecipeLayout | null = null;
  @Input() device: RecipeLayoutDevice | null = null;
}

const LAYOUT: RecipeLayout = {
  rows: [
    { items: [{ type: 'TITLE', span: 12, text: 'Bobinado' }] },
    {
      items: [
        { type: 'VARIABLE', span: 6, signalVariableName: 'rEspiras' },
        { type: 'SPACER', span: 6 },
      ],
    },
    {
      items: [
        { type: 'TEXT', span: 4, text: 'Ayuda de la sección' },
        { type: 'VARIABLE', span: 8, signalVariableName: 'rVelocidad' },
      ],
    },
    // Una variable que ya no es visible no se pinta, y la fila de solo huecos tampoco.
    {
      items: [
        { type: 'VARIABLE', span: 6, signalVariableName: 'xOculta' },
        { type: 'SPACER', span: 6 },
      ],
    },
  ],
};

describe('RecipeLayoutComponent (docs/specs/26-receta-base.md, "Disposición")', () => {
  it('pinta títulos, textos y variables en el orden de la disposición', async () => {
    const { container } = await render(HostComponent, {
      inputs: { variables: [variable('rEspiras'), variable('rVelocidad')], layout: LAYOUT },
    });

    expect(screen.getByRole('heading', { name: 'Bobinado' })).toBeInTheDocument();
    expect(screen.getByText('Ayuda de la sección')).toBeInTheDocument();
    expect(screen.getAllByTestId('field').map((field) => field.textContent)).toEqual([
      'rEspiras',
      'rVelocidad',
    ]);
    expect(container.querySelectorAll('.recipe-layout__row')).toHaveLength(3);
  });

  it('pasa el ancho a cada celda y marca las de hasta el 50 %', async () => {
    const { container } = await render(HostComponent, {
      inputs: { variables: [variable('rEspiras'), variable('rVelocidad')], layout: LAYOUT },
    });

    const cells = [...container.querySelectorAll<HTMLElement>('.recipe-layout__cell')];
    const espiras = cells.find((cell) => cell.textContent?.includes('rEspiras'))!;
    expect(espiras.style.getPropertyValue('--span')).toBe('6');
    expect(espiras).toHaveClass('recipe-layout__cell--half');
    const spacer = container.querySelector('.recipe-layout__cell--spacer');
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
  });

  it('sin disposición pone una variable por fila', async () => {
    const { container } = await render(HostComponent, {
      inputs: { variables: [variable('a'), variable('b')] },
    });

    expect(container.querySelectorAll('.recipe-layout__row')).toHaveLength(2);
  });

  it('fuerza el ancho del dispositivo de la vista previa', async () => {
    const { container } = await render(HostComponent, {
      inputs: { variables: [variable('rEspiras')], layout: LAYOUT, device: 'mobile' },
    });

    expect(container.querySelector('.recipe-layout')).toHaveClass('recipe-layout--mobile');
  });
});
