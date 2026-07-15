import { alarmDetailBreadcrumb, alarmsListBreadcrumb, alarmsListCrumb } from './alarms-breadcrumbs';

describe('alarms-breadcrumbs', () => {
  it('alarmDetailBreadcrumb tiene 2 tramos: Alarmas (enlazado) y Detalle (actual)', () => {
    expect(alarmDetailBreadcrumb).toHaveLength(2);
    expect(alarmDetailBreadcrumb[0]).toBe(alarmsListCrumb);
    expect(alarmDetailBreadcrumb[1]).toEqual({ label: 'Detalle' });
  });

  it('alarmsListBreadcrumb tiene 1 tramo (la página actual, panel de Alarmas)', () => {
    expect(alarmsListBreadcrumb).toEqual([alarmsListCrumb]);
  });

  it('alarmsListCrumb enlaza a /alarms', () => {
    expect(alarmsListCrumb.link?.(undefined as never)).toEqual(['/alarms']);
  });
});
