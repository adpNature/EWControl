import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MachinesApiService } from '../adapters/machines-api.service';
import { Machine } from '../entities/machine.model';
import { MachinesState } from './machines.state';

const MACHINE_1: Machine = { id: 'machine-1', companyId: 'company-1', name: 'Bobinadora 1' };
const MACHINE_2: Machine = { id: 'machine-2', companyId: 'company-1', name: 'Bobinadora 2' };

describe('MachinesState', () => {
  let service: MachinesState;
  let machinesApi: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    machinesApi = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: MachinesApiService, useValue: machinesApi }],
    });
    service = TestBed.inject(MachinesState);
  });

  it('load() sincroniza el signal machines con la respuesta', async () => {
    machinesApi.list.mockReturnValue(
      of({ data: [MACHINE_1, MACHINE_2], total: 2, limit: 20, offset: 0 }),
    );

    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );

    expect(service.machines()).toEqual([MACHINE_1, MACHINE_2]);
    expect(service.loading()).toBe(false);
  });

  it('load() en fallo apaga loading sin romper', async () => {
    machinesApi.list.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) => service.load().subscribe({ next: resolve, error: reject })),
    ).rejects.toBeTruthy();

    expect(service.loading()).toBe(false);
  });

  it('create() añade la Machine creada al signal', async () => {
    machinesApi.create.mockReturnValue(of(MACHINE_1));

    await new Promise((resolve, reject) =>
      service.create({ name: 'Bobinadora 1' }).subscribe({ next: resolve, error: reject }),
    );

    expect(service.machines()).toEqual([MACHINE_1]);
  });

  it('update() reemplaza la Machine actualizada en el signal', async () => {
    machinesApi.list.mockReturnValue(of({ data: [MACHINE_1], total: 1, limit: 20, offset: 0 }));
    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );
    const updated = { ...MACHINE_1, name: 'Nuevo nombre' };
    machinesApi.update.mockReturnValue(of(updated));

    await new Promise((resolve, reject) =>
      service
        .update('machine-1', { name: 'Nuevo nombre' })
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.machines()).toEqual([updated]);
  });

  it('remove() retira la Machine del signal', async () => {
    machinesApi.list.mockReturnValue(
      of({ data: [MACHINE_1, MACHINE_2], total: 2, limit: 20, offset: 0 }),
    );
    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );
    machinesApi.remove.mockReturnValue(of(undefined));

    await new Promise((resolve, reject) =>
      service.remove('machine-1').subscribe({ next: resolve, error: reject }),
    );

    expect(service.machines()).toEqual([MACHINE_2]);
  });
});
