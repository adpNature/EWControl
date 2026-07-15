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
      [confirmText]="confirmText"
      (confirmed)="onConfirm()"
      (cancelled)="onCancel()"
    />
  `,
})
class HostComponent {
  open = false;
  confirmText?: string;
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

  describe('con confirmText (escribe el nombre para confirmar)', () => {
    it('el botón de confirmar empieza deshabilitado', async () => {
      await render(HostComponent, {
        componentProperties: { open: true, confirmText: 'ACME' },
      });

      expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
    });

    it('sigue deshabilitado si el texto tecleado no coincide exactamente', async () => {
      await render(HostComponent, {
        componentProperties: { open: true, confirmText: 'ACME' },
      });

      await userEvent.type(screen.getByRole('textbox'), 'acme');

      expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
    });

    it('se habilita cuando el texto tecleado coincide exactamente y permite confirmar', async () => {
      const { fixture } = await render(HostComponent, {
        componentProperties: { open: true, confirmText: 'ACME' },
      });

      await userEvent.type(screen.getByRole('textbox'), 'ACME');
      const confirmButton = screen.getByRole('button', { name: 'Eliminar' });
      expect(confirmButton).toBeEnabled();

      await userEvent.click(confirmButton);
      expect(fixture.componentInstance.confirmed).toBe(true);
    });

    it('resetea el texto tecleado cada vez que el diálogo se vuelve a abrir', async () => {
      const { fixture } = await render(HostComponent, {
        componentProperties: { open: true, confirmText: 'ACME' },
      });
      await userEvent.type(screen.getByRole('textbox'), 'ACME');
      expect(screen.getByRole('button', { name: 'Eliminar' })).toBeEnabled();

      fixture.componentInstance.open = false;
      fixture.detectChanges();
      fixture.componentInstance.open = true;
      fixture.detectChanges();

      expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDisabled();
      expect(screen.getByRole('textbox')).toHaveValue('');
    });
  });
});
