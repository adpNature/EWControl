import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('setItem/getItem delegan en window.localStorage', () => {
    const service = TestBed.inject(LocalStorageService);

    service.setItem('k', 'v');

    expect(service.getItem('k')).toBe('v');
  });

  it('getItem devuelve null si la clave no existe', () => {
    const service = TestBed.inject(LocalStorageService);

    expect(service.getItem('inexistente')).toBeNull();
  });

  it('setItem no lanza si localStorage lanza (ej. modo privado / cuota agotada)', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const service = TestBed.inject(LocalStorageService);

    expect(() => service.setItem('k', 'v')).not.toThrow();
  });

  it('getItem devuelve null si localStorage lanza', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('boom');
    });
    const service = TestBed.inject(LocalStorageService);

    expect(service.getItem('k')).toBeNull();
  });
});
