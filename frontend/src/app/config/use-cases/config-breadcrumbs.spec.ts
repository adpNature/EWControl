import { TestBed } from '@angular/core/testing';
import { convertToParamMap } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { CompaniesApiService } from '../adapters/companies-api.service';
import { MachinesApiService } from '../adapters/machines-api.service';
import { SignalsApiService } from '../adapters/signals-api.service';
import { UsersApiService } from '../adapters/users-api.service';
import { CompaniesState } from './companies.state';
import {
  companiesCrumb,
  companiesListBreadcrumb,
  companyNameResolver,
  machineNameResolver,
  machinesCrumb,
  machinesListBreadcrumb,
  signalNameResolver,
  userNameResolver,
  usersCrumb,
  usersListBreadcrumb,
} from './config-breadcrumbs';
import { MachinesState } from './machines.state';
import { SignalsState } from './signals.state';
import { UsersState } from './users.state';

describe('config-breadcrumbs — breadcrumbs de listado (1 tramo, página actual)', () => {
  it('machinesListBreadcrumb / usersListBreadcrumb / companiesListBreadcrumb tienen un único tramo', () => {
    expect(machinesListBreadcrumb).toEqual([machinesCrumb]);
    expect(usersListBreadcrumb).toEqual([usersCrumb]);
    expect(companiesListBreadcrumb).toEqual([companiesCrumb]);
  });
});

describe('config-breadcrumbs resolvers', () => {
  it('machineNameResolver usa la Machine ya cacheada en MachinesState sin llamar al Backend', async () => {
    const machinesApi = { get: vi.fn() };
    const machinesState = { machines: () => [{ id: 'machine-1', name: 'Torno 3' }] };

    TestBed.configureTestingModule({
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: MachinesState, useValue: machinesState },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        machineNameResolver(convertToParamMap({ machineId: 'machine-1' }), undefined!),
      ),
    );

    expect(result).toBe('Torno 3');
    expect(machinesApi.get).not.toHaveBeenCalled();
  });

  it('machineNameResolver recurre al Backend si la Machine no está en caché', async () => {
    const machinesApi = {
      get: vi.fn().mockReturnValue(of({ id: 'machine-2', name: 'Bobinadora 1' })),
    };
    const machinesState = { machines: () => [] };

    TestBed.configureTestingModule({
      providers: [
        { provide: MachinesApiService, useValue: machinesApi },
        { provide: MachinesState, useValue: machinesState },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        machineNameResolver(convertToParamMap({ machineId: 'machine-2' }), undefined!),
      ),
    );

    expect(result).toBe('Bobinadora 1');
    expect(machinesApi.get).toHaveBeenCalledWith('machine-2');
  });

  it('signalNameResolver usa la Signal cacheada en SignalsState', async () => {
    const signalsApi = { get: vi.fn() };
    const signalsState = { signals: () => [{ id: 'signal-1', name: 'Temperatura' }] };

    TestBed.configureTestingModule({
      providers: [
        { provide: SignalsApiService, useValue: signalsApi },
        { provide: SignalsState, useValue: signalsState },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        signalNameResolver(
          convertToParamMap({ machineId: 'machine-1', signalId: 'signal-1' }),
          undefined!,
        ),
      ),
    );

    expect(result).toBe('Temperatura');
    expect(signalsApi.get).not.toHaveBeenCalled();
  });

  it('companyNameResolver recurre al Backend si la Company no está en caché', async () => {
    const companiesApi = { get: vi.fn().mockReturnValue(of({ id: 'company-1', name: 'Acme' })) };
    const companiesState = { companies: () => [] };

    TestBed.configureTestingModule({
      providers: [
        { provide: CompaniesApiService, useValue: companiesApi },
        { provide: CompaniesState, useValue: companiesState },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(
        companyNameResolver(convertToParamMap({ companyId: 'company-1' }), undefined!),
      ),
    );

    expect(result).toBe('Acme');
    expect(companiesApi.get).toHaveBeenCalledWith('company-1');
  });

  it('userNameResolver usa el User cacheado en UsersState (muestra su email)', async () => {
    const usersApi = { get: vi.fn() };
    const usersState = { users: () => [{ id: 'user-1', email: 'demo@ewcontrol.local' }] };

    TestBed.configureTestingModule({
      providers: [
        { provide: UsersApiService, useValue: usersApi },
        { provide: UsersState, useValue: usersState },
      ],
    });

    const result = await TestBed.runInInjectionContext(() =>
      firstValueFrom(userNameResolver(convertToParamMap({ userId: 'user-1' }), undefined!)),
    );

    expect(result).toBe('demo@ewcontrol.local');
    expect(usersApi.get).not.toHaveBeenCalled();
  });
});
