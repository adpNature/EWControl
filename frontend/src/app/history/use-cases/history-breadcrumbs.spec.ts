import { historyBreadcrumb, historyCrumb } from './history-breadcrumbs';

describe('history-breadcrumbs', () => {
  it('historyBreadcrumb tiene un único tramo (la propia página)', () => {
    expect(historyBreadcrumb).toEqual([historyCrumb]);
  });

  it('historyCrumb enlaza a /history', () => {
    expect(historyCrumb.link?.(undefined as never)).toEqual(['/history']);
  });
});
