export class DashboardNotFoundError extends Error {
  constructor(dashboardId: string) {
    super(`No existe el Dashboard ${dashboardId}.`);
    this.name = 'DashboardNotFoundError';
  }
}
