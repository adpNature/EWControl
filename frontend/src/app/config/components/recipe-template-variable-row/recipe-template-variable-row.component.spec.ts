import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  RecipeTemplateVariable,
  RecipeVariableConfig,
} from '../../../recipes/entities/recipe-template.model';
import { RecipeTemplateVariableRowComponent } from './recipe-template-variable-row.component';

function variable(
  overrides: Partial<RecipeTemplateVariable> = {},
  config: Partial<RecipeVariableConfig> = {},
): RecipeTemplateVariable {
  return {
    signalVariableName: 'rEspiras',
    dataType: 'Float',
    comment: 'Número de espiras',
    mappingMin: 0,
    mappingMax: 10000,
    isUnconfigured: false,
    suggestedOptions: null,
    suggestedBooleanLabels: null,
    ...overrides,
    config: {
      mode: 'EDITABLE',
      label: null,
      helpText: null,
      unit: null,
      decimals: null,
      min: null,
      max: null,
      minLength: null,
      maxLength: null,
      booleanLabels: null,
      options: null,
      defaultValue: null,
      fixedValue: null,
      ...config,
    },
  };
}

async function renderRow(input: RecipeTemplateVariable, errors?: Record<string, string>) {
  const variableChange = vi.fn();
  await render(RecipeTemplateVariableRowComponent, {
    inputs: { variable: input, errors },
    on: { variableChange },
  });
  return {
    variableChange,
    last: () => variableChange.mock.lastCall?.[0] as RecipeTemplateVariable,
  };
}

describe('RecipeTemplateVariableRowComponent (docs/specs/26-receta-base.md)', () => {
  it('muestra el nombre, el tipo, la descripción y el modo elegido', async () => {
    await renderRow(variable({}, { label: 'Espiras' }));

    expect(screen.getByRole('heading', { name: /Espiras/ })).toHaveTextContent('rEspiras');
    expect(screen.getByText('Decimal (Float)')).toBeInTheDocument();
    expect(screen.getByText('Número de espiras')).toBeInTheDocument();
    const modes = screen.getByRole('group', { name: 'Modo de Espiras' });
    expect(within(modes).getByRole('radio', { name: 'Editable' })).toBeChecked();
  });

  it('cambiar a fija emite la variable con el valor por defecto como valor fijo', async () => {
    const { last } = await renderRow(variable({}, { defaultValue: 120 }));

    await userEvent.click(screen.getByRole('radio', { name: 'Fija y oculta' }));

    expect(last().config).toMatchObject({ mode: 'FIXED_HIDDEN', fixedValue: 120 });
  });

  it('una fija muestra su valor fijo y emite los cambios', async () => {
    const { last } = await renderRow(variable({}, { mode: 'FIXED_HIDDEN', fixedValue: null }), {
      fixedValue: 'Un valor fijo es obligatorio.',
    });

    const fixed = screen.getByRole('spinbutton', { name: 'Valor fijo' });
    expect(fixed).toHaveAccessibleDescription(/Un valor fijo es obligatorio./);
    await userEvent.type(fixed, '7');

    expect(last().config.fixedValue).toBe(7);
    // Una fija oculta no tiene más ajustes.
    expect(screen.queryByRole('button', { name: /más ajustes/ })).not.toBeInTheDocument();
  });

  it('las variables nuevas se señalan como sin configurar', async () => {
    await renderRow(variable({ isUnconfigured: true }, { mode: 'HIDDEN' }));

    expect(screen.getByText('Sin configurar')).toBeInTheDocument();
  });

  it('al desplegar solo enseña los ajustes que aplican a su tipo y modo', async () => {
    const { last } = await renderRow(variable());

    const toggle = screen.getByRole('button', { name: /más ajustes/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByLabelText('Nombre visible')).toHaveAttribute('placeholder', 'rEspiras');
    expect(screen.getByLabelText('Unidad')).toBeInTheDocument();
    expect(screen.getByLabelText('Decimales')).toBeInTheDocument();
    expect(screen.getByLabelText('Mínimo')).toHaveAccessibleDescription(
      'Límites del mapeo: 0 a 10000. El rango de la receta debe quedar dentro.',
    );
    expect(screen.queryByText('Lista de opciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Textos del interruptor')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Máximo'), '5');
    expect(last().config.max).toBe(5);
  });

  it('un Boolean ofrece los textos del interruptor y la sugerencia de la descripción', async () => {
    const { last } = await renderRow(
      variable({
        signalVariableName: 'xSentido',
        dataType: 'Boolean',
        suggestedBooleanLabels: { falseLabel: 'Horario', trueLabel: 'Antihorario' },
      }),
    );
    expect(screen.getByText('Sugerencia')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /más ajustes/ }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Usar «Horario / Antihorario» de la descripción' }),
    );

    expect(last().config.booleanLabels).toEqual({
      falseLabel: 'Horario',
      trueLabel: 'Antihorario',
    });
    expect(screen.queryByLabelText('Unidad')).not.toBeInTheDocument();
  });

  it('un entero gestiona su lista de opciones', async () => {
    const options = [
      { value: 0, label: 'Continuar' },
      { value: 1, label: 'Parar' },
    ];
    const { last } = await renderRow(
      variable({ signalVariableName: 'iModo', dataType: 'Int16', suggestedOptions: options }),
    );
    await userEvent.click(screen.getByRole('button', { name: /más ajustes/ }));

    await userEvent.click(
      screen.getByRole('button', { name: /Usar las opciones de la descripción/ }),
    );
    expect(last().config.options).toEqual(options);
  });

  it('edita, añade y quita opciones', async () => {
    const { last } = await renderRow(
      variable(
        { signalVariableName: 'iModo', dataType: 'Int16' },
        { options: [{ value: 0, label: 'A' }] },
      ),
      { options: 'Añade al menos 2 opciones o quita la lista.' },
    );
    await userEvent.click(screen.getByRole('button', { name: /más ajustes/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('Añade al menos 2 opciones');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir opción' }));
    expect(last().config.options).toEqual([
      { value: 0, label: 'A' },
      { value: 1, label: '' },
    ]);

    await userEvent.type(screen.getByLabelText('Texto de la opción 1'), 'x');
    expect(last().config.options?.[0].label).toBe('Ax');

    await userEvent.click(screen.getByRole('button', { name: 'Quitar la opción 1' }));
    expect(last().config.options).toBeNull();
  });

  it('cuenta los errores de los ajustes plegados', async () => {
    await renderRow(variable(), { min: 'Fuera del rango que admite el tipo.' });

    expect(screen.getByRole('button', { name: /1 error/ })).toBeInTheDocument();
  });
});
