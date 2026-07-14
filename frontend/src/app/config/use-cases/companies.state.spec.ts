import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CompaniesApiService } from '../adapters/companies-api.service';
import { Company } from '../entities/company.model';
import { CompaniesState } from './companies.state';

const COMPANY_1: Company = { id: 'company-1', name: 'ACME', isActive: true };
const COMPANY_2: Company = { id: 'company-2', name: 'Globex', isActive: true };

describe('CompaniesState', () => {
  let service: CompaniesState;
  let companiesApi: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    companiesApi = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: CompaniesApiService, useValue: companiesApi }],
    });
    service = TestBed.inject(CompaniesState);
  });

  it('load() sincroniza el signal companies con la respuesta', async () => {
    companiesApi.list.mockReturnValue(
      of({ data: [COMPANY_1, COMPANY_2], total: 2, limit: 20, offset: 0 }),
    );

    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );

    expect(service.companies()).toEqual([COMPANY_1, COMPANY_2]);
    expect(service.loading()).toBe(false);
  });

  it('load() en fallo apaga loading sin romper', async () => {
    companiesApi.list.mockReturnValue(throwError(() => new Error('network error')));

    await expect(
      new Promise((resolve, reject) => service.load().subscribe({ next: resolve, error: reject })),
    ).rejects.toBeTruthy();

    expect(service.loading()).toBe(false);
  });

  it('create() añade la Company creada al signal', async () => {
    companiesApi.create.mockReturnValue(of(COMPANY_1));

    await new Promise((resolve, reject) =>
      service.create({ name: 'ACME' }).subscribe({ next: resolve, error: reject }),
    );

    expect(service.companies()).toEqual([COMPANY_1]);
  });

  it('update() reemplaza la Company actualizada en el signal', async () => {
    companiesApi.list.mockReturnValue(of({ data: [COMPANY_1], total: 1, limit: 20, offset: 0 }));
    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );
    const updated = { ...COMPANY_1, name: 'ACME Corp' };
    companiesApi.update.mockReturnValue(of(updated));

    await new Promise((resolve, reject) =>
      service
        .update('company-1', { name: 'ACME Corp' })
        .subscribe({ next: resolve, error: reject }),
    );

    expect(service.companies()).toEqual([updated]);
  });

  it('remove() retira la Company del signal', async () => {
    companiesApi.list.mockReturnValue(
      of({ data: [COMPANY_1, COMPANY_2], total: 2, limit: 20, offset: 0 }),
    );
    await new Promise((resolve, reject) =>
      service.load().subscribe({ next: resolve, error: reject }),
    );
    companiesApi.remove.mockReturnValue(of(undefined));

    await new Promise((resolve, reject) =>
      service.remove('company-1').subscribe({ next: resolve, error: reject }),
    );

    expect(service.companies()).toEqual([COMPANY_2]);
  });
});
