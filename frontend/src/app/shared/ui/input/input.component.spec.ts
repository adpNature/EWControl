import { Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { InputComponent } from './input.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent],
  template: `<app-input
    [formControl]="control"
    label="Email"
    type="email"
    [errorMessage]="errorMessage"
  />`,
})
class HostComponent {
  @Input() control = new FormControl('');
  @Input() errorMessage: string | null = null;
}

describe('InputComponent', () => {
  it('asocia el label con el control, accesible por texto de label', async () => {
    await render(HostComponent);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('actualiza el FormControl cuando el usuario escribe', async () => {
    const { fixture } = await render(HostComponent);

    await userEvent.type(screen.getByLabelText('Email'), 'demo@ewcontrol.local');

    expect(fixture.componentInstance.control.value).toBe('demo@ewcontrol.local');
  });

  it('refleja el valor inicial del FormControl (writeValue)', async () => {
    await render(HostComponent, { inputs: { control: new FormControl('preset@ewcontrol.local') } });

    expect(screen.getByLabelText('Email')).toHaveValue('preset@ewcontrol.local');
  });

  it('muestra el mensaje de error como región role="alert" cuando se indica', async () => {
    await render(HostComponent, { inputs: { errorMessage: 'Campo requerido' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Campo requerido');
  });

  it('deshabilita el input cuando el FormControl está deshabilitado', async () => {
    const disabledControl = new FormControl('');
    disabledControl.disable();

    await render(HostComponent, { inputs: { control: disabledControl } });

    expect(screen.getByLabelText('Email')).toBeDisabled();
  });
});
