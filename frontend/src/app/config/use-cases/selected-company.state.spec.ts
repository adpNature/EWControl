import { TestBed } from '@angular/core/testing';
import { SelectedCompanyState } from './selected-company.state';

describe('SelectedCompanyState', () => {
  let service: SelectedCompanyState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SelectedCompanyState);
  });

  it('empieza sin ninguna Company seleccionada', () => {
    expect(service.selectedCompanyId()).toBeNull();
  });

  it('select() fija la Company seleccionada', () => {
    service.select('company-1');

    expect(service.selectedCompanyId()).toBe('company-1');
  });

  it('clear() vuelve a dejar la selección vacía', () => {
    service.select('company-1');

    service.clear();

    expect(service.selectedCompanyId()).toBeNull();
  });
});
