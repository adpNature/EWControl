import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { UsersApiService } from '../adapters/users-api.service';
import { ManagedUser } from '../entities/user.model';
import { UsersState } from './users.state';

const USER_1: ManagedUser = {
  id: 'user-1',
  companyId: 'company-1',
  email: 'demo@ewcontrol.local',
  role: 'AdminCliente',
  isActive: true,
};
const USER_2: ManagedUser = {
  id: 'user-2',
  companyId: 'company-1',
  email: 'otro@ewcontrol.local',
  role: 'AdminCliente',
  isActive: true,
};

describe('UsersState', () => {
  let service: UsersState;
  let usersApi: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    usersApi = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: UsersApiService, useValue: usersApi }],
    });
    service = TestBed.inject(UsersState);
  });

  it('load() sincroniza el signal users con la respuesta', async () => {
    usersApi.list.mockReturnValue(of({ data: [USER_1, USER_2], total: 2, limit: 20, offset: 0 }));

    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );

    expect(service.users()).toEqual([USER_1, USER_2]);
    expect(service.loading()).toBe(false);
  });

  it('load() reenvía companyId al servicio (switcher de SuperAdmin)', async () => {
    usersApi.list.mockReturnValue(of({ data: [], total: 0, limit: 20, offset: 0 }));

    await new Promise((resolve, reject) =>
      service.load('company-2').subscribe({ next: resolve, error: reject }),
    );

    expect(usersApi.list).toHaveBeenCalledWith({ limit: 20, offset: 0, companyId: 'company-2' });
  });

  it('load() en fallo apaga loading sin romper', async () => {
    usersApi.list.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) => service.load().subscribe({ next: resolve, error: reject })),
    ).rejects.toBeTruthy();

    expect(service.loading()).toBe(false);
  });

  it('create() añade el User creado al signal', async () => {
    usersApi.create.mockReturnValue(of(USER_1));

    await new Promise((resolve, reject) =>
      service
        .create({ email: 'demo@ewcontrol.local', password: 'Demo1234!', role: 'AdminCliente' })
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.users()).toEqual([USER_1]);
  });

  it('update() reemplaza el User actualizado en el signal', async () => {
    usersApi.list.mockReturnValue(of({ data: [USER_1], total: 1, limit: 20, offset: 0 }));
    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );
    const updated = { ...USER_1, email: 'nuevo@ewcontrol.local' };
    usersApi.update.mockReturnValue(of(updated));

    await new Promise((resolve, reject) =>
      service
        .update('user-1', { email: 'nuevo@ewcontrol.local' })
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.users()).toEqual([updated]);
  });

  it('remove() retira el User del signal', async () => {
    usersApi.list.mockReturnValue(of({ data: [USER_1, USER_2], total: 2, limit: 20, offset: 0 }));
    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );
    usersApi.remove.mockReturnValue(of(undefined));

    await new Promise((resolve, reject) =>
      service.remove('user-1').subscribe({ next: resolve, error: reject }),
    );

    expect(service.users()).toEqual([USER_2]);
  });
});
