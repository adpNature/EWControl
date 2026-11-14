import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { RecipeTemplateVariable } from '../../../recipes/entities/recipe-template.model';
import {
  EditorRow,
  emptyErrors,
  toEditorRows,
} from '../../../recipes/use-cases/recipe-template-rules';
import { RecipeLayoutEditorComponent } from './recipe-layout-editor.component';

function variable(name: string, label: string | null = null): RecipeTemplateVariable {
  return {
    signalVariableName: name,
    dataType: 'Float',
    comment: null,
    mappingMin: null,
    mappingMax: null,
    isUnconfigured: false,
    suggestedOptions: null,
    suggestedBooleanLabels: null,
    config: {
      mode: 'EDITABLE',
      label,
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
    },
  };
}

const VARIABLES = [variable('rEspiras', 'Espiras'), variable('rVelocidad'), variable('rDiametro')];

function startRows(): EditorRow[] {
  return toEditorRows({
    rows: [
      { items: [{ type: 'TITLE', span: 12, text: 'Bobinado' }] },
      {
        items: [
          { type: 'VARIABLE', span: 4, signalVariableName: 'rEspiras' },
          { type: 'VARIABLE', span: 4, signalVariableName: 'rVelocidad' },
        ],
      },
      { items: [{ type: 'VARIABLE', span: 6, signalVariableName: 'rDiametro' }] },
    ],
  });
}

async function renderEditor(rows = startRows(), errors = emptyErrors()) {
  const rowsChange = vi.fn();
  await render(RecipeLayoutEditorComponent, {
    inputs: { rows, variables: VARIABLES, errors },
    on: { rowsChange },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  const last = () => rowsChange.mock.lastCall?.[0] as EditorRow[];
  const shape = () =>
    last().map((row) =>
      row.items.map((item) => `${item.signalVariableName ?? item.type}:${item.span}`),
    );
  return { rowsChange, last, shape };
}

describe('RecipeLayoutEditorComponent (docs/specs/26-receta-base.md, "Disposición")', () => {
  it('pinta cada fila con lo que ocupa y sus elementos con su nombre visible', async () => {
    await renderEditor();

    const row = screen.getByRole('region', { name: 'Fila 2' });
    expect(within(row).getByRole('img', { name: 'Ocupa el 67 %' })).toBeInTheDocument();
    expect(within(row).getByText('Espiras')).toBeInTheDocument();
    expect(within(row).getByText('rVelocidad')).toBeInTheDocument();
    expect(screen.getByLabelText('Texto del título de la fila 1')).toHaveValue('Bobinado');
  });

  it('cambia el ancho y lo anuncia', async () => {
    const { shape } = await renderEditor();

    await userEvent.selectOptions(screen.getByLabelText('Ancho de Espiras'), '6');

    expect(shape()[1]).toEqual(['rEspiras:6', 'rVelocidad:4']);
    expect(screen.getByText('Espiras: 50 %.')).toBeInTheDocument();
  });

  it('mueve elementos dentro de la fila y entre filas con botones', async () => {
    const { shape } = await renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Mover Espiras a la derecha' }));
    expect(shape()[1]).toEqual(['rVelocidad:4', 'rEspiras:4']);
    expect(screen.getByText('Espiras: fila 2, posición 2.')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Mover rDiametro a la fila de arriba' }),
    );
    expect(shape()).toEqual([['TITLE:12'], ['rEspiras:4', 'rVelocidad:4', 'rDiametro:6']]);
  });

  it('deshabilita los movimientos imposibles', async () => {
    await renderEditor();

    expect(screen.getByRole('button', { name: 'Mover Espiras a la izquierda' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Subir la fila 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bajar la fila 3' })).toBeDisabled();
  });

  it('sube y baja filas', async () => {
    const { shape } = await renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Bajar la fila 1' }));

    expect(shape()[1]).toEqual(['TITLE:12']);
  });

  it('añade títulos, textos y huecos, y quita los que no son variables', async () => {
    const { shape, last } = await renderEditor();

    await userEvent.click(screen.getByRole('button', { name: 'Título de sección' }));
    expect(shape().at(-1)).toEqual(['TITLE:12']);
    await userEvent.click(screen.getByRole('button', { name: 'Hueco' }));
    expect(shape().at(-1)).toEqual(['rDiametro:6', 'SPACER:3']);

    await userEvent.click(screen.getByRole('button', { name: 'Quitar Título «Bobinado»' }));
    expect(last()).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Quitar Espiras' })).not.toBeInTheDocument();
  });

  it('escribe el texto de un título', async () => {
    const { last } = await renderEditor();

    await userEvent.type(screen.getByLabelText('Texto del título de la fila 1'), '!');

    expect(last()[0].items[0].text).toBe('Bobinado!');
  });

  it('señala las filas de más del 100 % y los textos que faltan', async () => {
    const rows = startRows();
    const errors = emptyErrors();
    errors.rows[rows[1].uid] = 'Esta fila ocupa más del 100 %.';
    errors.items[rows[0].items[0].uid] = 'Escribe el título.';
    await renderEditor(rows, errors);

    expect(screen.getByRole('alert')).toHaveTextContent('Esta fila ocupa más del 100 %.');
    expect(screen.getByText('Escribe el título.')).toBeInTheDocument();
    expect(screen.getByLabelText('Texto del título de la fila 1')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('sin elementos explica qué hacer', async () => {
    await renderEditor([]);

    expect(screen.getByText(/No hay nada en el formulario/)).toBeInTheDocument();
  });
});
