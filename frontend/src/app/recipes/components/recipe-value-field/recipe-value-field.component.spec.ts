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

describe('RecipeValueFieldComponent con receta base (docs/specs/26-receta-base.md)', () => {
  it('usa la etiqueta, enseña el nombre del PLC aparte y la unidad como sufijo', async () => {
    await render(RecipeValueFieldComponent, {
      inputs: {
        variable: variable({ label: 'Espiras', unit: 'vueltas', min: 1, max: 500 }),
        value: 10,
      },
    });

    const input = screen.getByRole('spinbutton', { name: 'Espiras' });
    expect(input).toHaveAccessibleDescription('Entre 1 y 500 vueltas.');
    expect(screen.getByText('rEspiras')).toBeInTheDocument();
    expect(screen.getByText('vueltas')).toBeInTheDocument();
  });

  it('los decimales fijan el paso del campo y los enteros no admiten decimales', async () => {
    const { rerender } = await render(RecipeValueFieldComponent, {
      inputs: { variable: variable({ decimals: 2 }), value: null },
    });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '0.01');

    await rerender({ inputs: { variable: variable({ dataType: 'Int16' }), value: null } });
    expect(screen.getByRole('spinbutton')).toHaveAttribute('step', '1');
    expect(screen.getByRole('spinbutton')).toHaveAttribute('inputmode', 'numeric');
  });

  it('un Boolean muestra el texto del estado actual', async () => {
    await render(RecipeValueFieldComponent, {
      inputs: {
        variable: variable({
          dataType: 'Boolean',
          label: 'Sentido',
          booleanLabels: { falseLabel: 'Horario', trueLabel: 'Antihorario' },
        }),
        value: false,
      },
    });

    expect(screen.getByRole('switch', { name: 'Sentido' })).not.toBeChecked();
    expect(screen.getByText('Horario')).toBeInTheDocument();
  });

  it('con opciones es un desplegable que emite el número elegido', async () => {
    const valueChange = vi.fn();
    await render(RecipeValueFieldComponent, {
      inputs: {
        variable: variable({
          dataType: 'Int16',
          label: 'Modo',
          options: [
            { value: 0, label: 'Continuar' },
            { value: 1, label: 'Parar' },
          ],
        }),
        value: null,
      },
      on: { valueChange },
    });

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modo' }), '1');
    expect(valueChange).toHaveBeenLastCalledWith(1);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Modo' }), '');
    expect(valueChange).toHaveBeenLastCalledWith(null);
  });

  it('un valor fijo visible se muestra en solo lectura con su texto', async () => {
    await render(RecipeValueFieldComponent, {
      inputs: {
        variable: variable({
          dataType: 'Int16',
          label: 'Modo',
          mode: 'FIXED_VISIBLE',
          fixedValue: 1,
          options: [
            { value: 0, label: 'Continuar' },
            { value: 1, label: 'Parar' },
          ],
        }),
        value: null,
      },
    });

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Modo' })).toHaveTextContent('Parar');
    expect(screen.getByText('Valor fijo')).toBeInTheDocument();
  });

  it('un texto enseña sus límites de longitud', async () => {
    await render(RecipeValueFieldComponent, {
      inputs: {
        variable: variable({ dataType: 'String', minLength: 2, maxLength: 10 }),
        value: '',
      },
    });

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('maxlength', '10');
    expect(input).toHaveAccessibleDescription('Entre 2 y 10 caracteres.');
  });
});
