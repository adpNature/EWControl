import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { SelectComponent, SelectOption } from './select.component';

const OPTIONS: SelectOption[] = [
  { value: 'AdminCliente', label: 'AdminCliente' },
  { value: 'SuperAdmin', label: 'SuperAdmin' },
];

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, SelectComponent],
  template: `<app-select
    [formControl]="control"
    label="Rol"
    [options]="options"
    [errorMessage]="errorMessage"
  />`,
})
class HostComponent {
  @Input() control = new FormControl('');
  @Input() options = OPTIONS;
  @Input() errorMessage: string | null = null;
}

describe('SelectComponent', () => {
  it('asocia el label con el control, accesible por texto de label', async () => {
    await render(HostComponent);

    expect(screen.getByLabelText('Rol')).toBeInTheDocument();
  });

  it('renderiza una opción por cada elemento de options', async () => {
    await render(HostComponent);

    expect(screen.getByRole('option', { name: 'AdminCliente' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'SuperAdmin' })).toBeInTheDocument();
  });

  it('actualiza el FormControl cuando el usuario elige una opción', async () => {
    const { fixture } = await render(HostComponent);

    await userEvent.selectOptions(screen.getByLabelText('Rol'), 'SuperAdmin');

    expect(fixture.componentInstance.control.value).toBe('SuperAdmin');
  });

  it('refleja el valor inicial del FormControl (writeValue)', async () => {
    await render(HostComponent, { inputs: { control: new FormControl('SuperAdmin') } });

    expect(screen.getByLabelText('Rol')).toHaveValue('SuperAdmin');
  });

  it('muestra el mensaje de error como región role="alert" cuando se indica', async () => {
    await render(HostComponent, { inputs: { errorMessage: 'Campo requerido' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Campo requerido');
  });

  it('deshabilita el select cuando el FormControl está deshabilitado', async () => {
    const disabledControl = new FormControl('');
    disabledControl.disable();

    await render(HostComponent, { inputs: { control: disabledControl } });

    expect(screen.getByLabelText('Rol')).toBeDisabled();
  });
});
