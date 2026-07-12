export class WidgetNotFoundError extends Error {
  constructor(widgetId: string) {
    super(`No existe el DashboardWidget ${widgetId}.`);
    this.name = 'WidgetNotFoundError';
  }
}
