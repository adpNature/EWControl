import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { RecipeVariable } from '../../entities/recipe.model';
import { RecipeValueFieldComponent } from './recipe-value-field.component';

function variable(overrides: Partial<RecipeVariable> = {}): RecipeVariable {
  return {
    signalVariableName: 'rEspiras',
    dataType: 'Float',
    comment: null,
    min: null,
    max: null,
    ...overrides,
  };
}

describe('RecipeValueFieldComponent (docs/specs/25-recetas.md)', () => {
  it('un Boolean es un interruptor accesible que emite el nuevo valor', async () => {
    const valueChange = vi.fn();
    await render(RecipeValueFieldComponent, {
      inputs: {
        variable: variable({
          signalVariableName: 'xSentidoCabezal',
          dataType: 'Boolean',
          comment: '2 opciones: 0 - Horario / 1 - Antihorario',
        }),
        value: false,
      },
      on: { valueChange },
    });

    const toggle = screen.getByRole('switch', { name: /xSentidoCabezal/ });
    expect(toggle).not.toBeChecked();
    expect(toggle).toHaveAccessibleDescription('2 opciones: 0 - Horario / 1 - Antihorario');

    await userEvent.click(toggle);

    expect(valueChange).toHaveBeenCalledWith(true);
  });

  it('un numérico es un campo con sus límites que emite números', async () => {
    const valueChange = vi.fn();
    await render(RecipeValueFieldComponent, {
      inputs: { variable: variable({ min: 0, max: 10000 }), value: null },
      on: { valueChange },
    });

    const input = screen.getByRole('spinbutton', { name: 'rEspiras' });
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '10000');
    expect(input).toHaveAccessibleDescription('Entre 0 y 10000.');

    await userEvent.type(input, '35');

    expect(valueChange).toHaveBeenLastCalledWith(35);
  });

  it('un String es un campo de texto', async () => {
    const valueChange = vi.fn();
    await render(RecipeValueFieldComponent, {
      inputs: {
        variable: variable({ signalVariableName: 'sNombre', dataType: 'String' }),
        value: '',
      },
      on: { valueChange },
    });

    await userEvent.type(screen.getByRole('textbox', { name: 'sNombre' }), 'A');

    expect(valueChange).toHaveBeenLastCalledWith('A');
  });

  it('muestra el error asociado al campo', async () => {
    await render(RecipeValueFieldComponent, {
      inputs: { variable: variable(), value: null, error: 'Obligatorio.' },
    });

    const input = screen.getByRole('spinbutton', { name: 'rEspiras' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Obligatorio.');
  });

  it('solo un mínimo o solo un máximo', async () => {
    const { rerender } = await render(RecipeValueFieldComponent, {
      inputs: { variable: variable({ min: 1 }), value: 2 },
    });
    expect(screen.getByText('Mínimo 1.')).toBeInTheDocument();

    await rerender({ inputs: { variable: variable({ max: 9 }), value: 2 } });
    expect(screen.getByText('Máximo 9.')).toBeInTheDocument();
  });
});
