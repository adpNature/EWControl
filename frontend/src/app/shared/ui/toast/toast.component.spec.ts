import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

describe('ToastComponent', () => {
  it('muestra un toast success en la región aria-live="polite"', async () => {
    const { fixture } = await render(ToastComponent);
    const toastService = TestBed.inject(ToastService);

    toastService.show({ type: 'success', message: 'Guardado' });
    fixture.detectChanges();

    const message = await screen.findByText('Guardado');
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('muestra un toast danger en la región aria-live="assertive"', async () => {
    const { fixture } = await render(ToastComponent);
    const toastService = TestBed.inject(ToastService);

    toastService.show({ type: 'danger', message: 'Error grave' });
    fixture.detectChanges();

    const message = await screen.findByText('Error grave');
    expect(message.closest('[aria-live="assertive"]')).not.toBeNull();
  });

  it('el botón "Cerrar notificación" retira el toast', async () => {
    const { fixture } = await render(ToastComponent);
    const toastService = TestBed.inject(ToastService);

    toastService.show({ type: 'info', message: 'Aviso' });
    fixture.detectChanges();
    await screen.findByText('Aviso');

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar notificación' }));

    expect(screen.queryByText('Aviso')).not.toBeInTheDocument();
  });
});
