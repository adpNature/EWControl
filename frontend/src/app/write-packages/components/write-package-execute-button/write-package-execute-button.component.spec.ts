import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Subject, of, throwError } from 'rxjs';
import { WritePackagesApiService } from '../../adapters/write-packages-api.service';
import { WritePackage, WritePackageExecution } from '../../entities/write-package.model';
import { WritePackageExecuteButtonComponent } from './write-package-execute-button.component';

const PACKAGE: WritePackage = {
  id: 'package-1',
  machineId: 'machine-1',
  name: 'Formato 120 mm',
  description: null,
  items: [
    { signalVariableName: 'Escritura_REAL', value: 120 },
    { signalVariableName: 'Escritura_BOOL', value: true },
  ],
  isActive: true,
  createdAt: '2026-10-30T10:00:00Z',
  updatedAt: '2026-10-30T10:00:00Z',
};

function execution(overrides: Partial<WritePackageExecution> = {}): WritePackageExecution {
  return {
    id: 'execution-1',
    packageId: 'package-1',
    machineId: 'machine-1',
    userEmail: 'operador@ewcontrol.local',
    executedAt: '2026-10-30T12:00:00Z',
    status: 'SUCCESS',
    reason: null,
    items: [
      { signalVariableName: 'Escritura_REAL', nodeId: 'a', value: 120, statusCode: 'Good' },
      { signalVariableName: 'Escritura_BOOL', nodeId: 'b', value: true, statusCode: 'Good' },
    ],
    ...overrides,
  };
}

describe('WritePackageExecuteButtonComponent', () => {
  let api: { execute: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { execute: vi.fn().mockReturnValue(of(execution())) };
  });

  function renderButton(disabledReason: string | null = null) {
    const executed = vi.fn();
    return render(WritePackageExecuteButtonComponent, {
      inputs: { machineId: 'machine-1', writePackage: PACKAGE, disabledReason },
      on: { executed },
      providers: [{ provide: WritePackagesApiService, useValue: api }],
    }).then((result) => ({ ...result, executed }));
  }

  it('pide confirmación mostrando las variables y valores exactos antes de escribir (criterio 3)', async () => {
    const user = userEvent.setup();
    await renderButton();

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Escritura_REAL = 120');
    expect(dialog).toHaveTextContent('Escritura_BOOL = Verdadero');
    expect(api.execute).not.toHaveBeenCalled();
  });

  it('al confirmar ejecuta y muestra el resultado por variable (criterio 4)', async () => {
    const user = userEvent.setup();
    const { executed } = await renderButton();

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await user.click(screen.getByRole('button', { name: 'Escribir en la máquina' }));

    expect(api.execute).toHaveBeenCalledWith('machine-1', 'package-1');
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Escrito correctamente');
    expect(within(status).getAllByRole('listitem')[0]).toHaveTextContent(
      'Escritura_REAL = 120 → Escrito',
    );
    expect(executed).toHaveBeenCalledWith(expect.objectContaining({ id: 'execution-1' }));
  });

  it('distingue un resultado PARTIAL con el error de cada variable (criterio 4)', async () => {
    api.execute.mockReturnValue(
      of(
        execution({
          status: 'PARTIAL',
          items: [
            { signalVariableName: 'Escritura_REAL', nodeId: 'a', value: 120, statusCode: 'Good' },
            {
              signalVariableName: 'Escritura_BOOL',
              nodeId: 'b',
              value: true,
              statusCode: 'BadNotWritable',
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    await renderButton();

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await user.click(screen.getByRole('button', { name: 'Escribir en la máquina' }));

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Escrito parcialmente');
    expect(status).toHaveTextContent('El PLC no permite escribir esta variable');
  });

  it('no permite doble envío mientras la escritura está en curso (criterio 3)', async () => {
    const pending = new Subject<WritePackageExecution>();
    api.execute.mockReturnValue(pending);
    const user = userEvent.setup();
    await renderButton();

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await user.click(screen.getByRole('button', { name: 'Escribir en la máquina' }));

    expect(screen.getByRole('button', { name: 'Ejecutando…' })).toBeDisabled();
    pending.next(execution());
    pending.complete();
    expect(api.execute).toHaveBeenCalledTimes(1);
  });

  it('cancelar no envía nada', async () => {
    const user = userEvent.setup();
    await renderButton();

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(api.execute).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('con un motivo de bloqueo, "Ejecutar" está deshabilitado y lo explica (criterio 6)', async () => {
    await renderButton('La Machine no está conectada a su PLC.');

    const button = screen.getByRole('button', { name: 'Ejecutar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('La Machine no está conectada a su PLC.');
  });

  it('un error de la API se muestra sin dar a entender que se ha escrito', async () => {
    api.execute.mockReturnValue(
      throwError(() => ({ status: 409, code: 'MACHINE_NOT_CONNECTED', message: '' })),
    );
    const user = userEvent.setup();
    await renderButton();

    await user.click(screen.getByRole('button', { name: 'Ejecutar' }));
    await user.click(screen.getByRole('button', { name: 'Escribir en la máquina' }));

    expect(screen.getByRole('alert')).toHaveTextContent('No se ha escrito nada');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
