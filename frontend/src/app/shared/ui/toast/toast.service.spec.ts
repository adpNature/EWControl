import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('show añade un toast a la cola', () => {
    service.show({ type: 'success', message: 'Guardado' });

    expect(service.toasts()).toHaveLength(1);
    expect(service.toasts()[0]).toMatchObject({ type: 'success', message: 'Guardado' });
  });

  it('descarta el toast más antiguo cuando ya hay 3 visibles', () => {
    service.show({ type: 'info', message: 'uno' });
    service.show({ type: 'info', message: 'dos' });
    service.show({ type: 'info', message: 'tres' });
    service.show({ type: 'info', message: 'cuatro' });

    expect(service.toasts().map((toast) => toast.message)).toEqual(['dos', 'tres', 'cuatro']);
  });

  it('auto-dismiss según el tipo (danger dura más que success)', () => {
    service.show({ type: 'success', message: 'ok' });
    service.show({ type: 'danger', message: 'error' });

    vi.advanceTimersByTime(4000);
    expect(service.toasts().map((toast) => toast.type)).toEqual(['danger']);

    vi.advanceTimersByTime(4001);
    expect(service.toasts()).toHaveLength(0);
  });

  it('dismiss retira un toast manualmente antes de su auto-dismiss', () => {
    const id = service.show({ type: 'warning', message: 'atención' });

    service.dismiss(id);

    expect(service.toasts()).toHaveLength(0);
  });
});
