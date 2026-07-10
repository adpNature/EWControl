import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ConfirmDialogComponent } from './confirm-dialog.component';

@Component({
  standalone: true,
  imports: [ConfirmDialogComponent],
  template: `
    <app-confirm-dialog
      [open]="open"
      title="Eliminar Machine"
      message="¿Seguro que quieres eliminar esta Machine? Sus Signals también se desactivarán."
      (confirmed)="onConfirm()"
      (cancelled)="onCancel()"
    />
  `,
})
class HostComponent {
  open = false;
  confirmed = false;
  cancelled = false;

  onConfirm(): void {
    this.confirmed = true;
  }

  onCancel(): void {
    this.cancelled = true;
  }
}

describe('ConfirmDialogComponent', () => {
  it('no renderiza nada cuando open es false', async () => {
    await render(HostComponent, { componentProperties: { open: false } });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('renderiza título y mensaje cuando open es true', async () => {
    await render(HostComponent, { componentProperties: { open: true } });

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAccessibleName('Eliminar Machine');
    expect(dialog).toHaveAccessibleDescription(/Sus Signals también se desactivarán/);
  });

  it('el botón de confirmar emite confirm', async () => {
    const { fixture } = await render(HostComponent, { componentProperties: { open: true } });

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    expect(fixture.componentInstance.confirmed).toBe(true);
  });

  it('el botón de cancelar emite cancel', async () => {
    const { fixture } = await render(HostComponent, { componentProperties: { open: true } });

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(fixture.componentInstance.cancelled).toBe(true);
  });

  it('Escape emite cancel', async () => {
    const { fixture } = await render(HostComponent, { componentProperties: { open: true } });

    await userEvent.keyboard('{Escape}');

    expect(fixture.componentInstance.cancelled).toBe(true);
  });

  it('click en el backdrop emite cancel, click dentro del diálogo no', async () => {
    const { fixture } = await render(HostComponent, { componentProperties: { open: true } });

    await userEvent.click(screen.getByRole('alertdialog'));
    expect(fixture.componentInstance.cancelled).toBe(false);

    await userEvent.click(screen.getByRole('alertdialog').parentElement!);
    expect(fixture.componentInstance.cancelled).toBe(true);
  });
});
