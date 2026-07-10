import { ActivatedRoute, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { MachinesApiService } from '../../adapters/machines-api.service';
import { MachinesState } from '../../use-cases/machines.state';
import { MachineFormPage } from './machine-form-page';

function activatedRouteStub(machineId: string | null) {
  return {
    snapshot: { paramMap: { get: (key: string) => (key === 'machineId' ? machineId : null) } },
  };
}

describe('MachineFormPage', () => {
  let machinesApi: { get: ReturnType<typeof vi.fn> };
  let machinesState: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    machinesApi = { get: vi.fn() };
    machinesState = { create: vi.fn(), update: vi.fn() };
    router = { navigate: vi.fn() };
  });

  function renderPage(machineId: string | null) {
    return render(MachineFormPage, {
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: MachinesState, useValue: machinesState },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: activatedRouteStub(machineId) },
      ],
    });
  }

  it('modo alta: no consulta ninguna Machine y el título es "Nueva Machine"', async () => {
    await renderPage(null);

    expect(screen.getByRole('heading', { name: 'Nueva Machine' })).toBeInTheDocument();
    expect(machinesApi.get).not.toHaveBeenCalled();
  });

  it('modo edición: precarga el nombre de la Machine existente', async () => {
    machinesApi.get.mockReturnValue(of({ id: 'machine-1', companyId: 'c', name: 'Bobinadora 1' }));

    await renderPage('machine-1');

    expect(screen.getByRole('heading', { name: 'Editar Machine' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Nombre')).toHaveValue('Bobinadora 1');
  });

  it('no llama a create si el formulario es inválido', async () => {
    await renderPage(null);

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(machinesState.create).not.toHaveBeenCalled();
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument();
  });

  it('en alta correcta navega al detalle de la Machine creada', async () => {
    machinesState.create.mockReturnValue(of({ id: 'machine-1', companyId: 'c', name: 'Nueva' }));
    await renderPage(null);

    await userEvent.type(screen.getByLabelText('Nombre'), 'Nueva');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(machinesState.create).toHaveBeenCalledWith({ name: 'Nueva' });
    expect(router.navigate).toHaveBeenCalledWith(['/config/machines', 'machine-1']);
  });

  it('muestra el error de MACHINE_INACTIVE sin perder los datos del formulario', async () => {
    machinesState.update.mockReturnValue(
      throwError(() => ({ status: 422, code: 'MACHINE_INACTIVE', message: 'irrelevante' })),
    );
    machinesApi.get.mockReturnValue(of({ id: 'machine-1', companyId: 'c', name: 'Bobinadora 1' }));
    await renderPage('machine-1');
    await screen.findByDisplayValue('Bobinadora 1');

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('desactivada');
    expect(screen.getByLabelText('Nombre')).toHaveValue('Bobinadora 1');
  });
});
