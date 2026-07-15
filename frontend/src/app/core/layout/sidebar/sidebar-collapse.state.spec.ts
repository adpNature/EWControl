import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from '../../storage/local-storage.service';
import { SidebarCollapseState } from './sidebar-collapse.state';

const STORAGE_KEY = 'ewcontrol.sidebar.collapsed';

function configure(getItem: (key: string) => string | null) {
  const setItem = vi.fn();
  TestBed.configureTestingModule({
    providers: [{ provide: LocalStorageService, useValue: { getItem, setItem } }],
  });
  return { setItem };
}

describe('SidebarCollapseState', () => {
  it('arranca colapsado si el storage guardó "1"', () => {
    configure(() => '1');

    const state = TestBed.inject(SidebarCollapseState);

    expect(state.collapsed()).toBe(true);
  });

  it('arranca expandido si no hay preferencia guardada', () => {
    configure(() => null);

    const state = TestBed.inject(SidebarCollapseState);

    expect(state.collapsed()).toBe(false);
  });

  it('toggle() invierte el estado y lo persiste', () => {
    const { setItem } = configure(() => null);
    const state = TestBed.inject(SidebarCollapseState);

    state.toggle();
    expect(state.collapsed()).toBe(true);
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, '1');

    state.toggle();
    expect(state.collapsed()).toBe(false);
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, '0');
  });
});
