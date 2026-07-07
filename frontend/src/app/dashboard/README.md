# Dashboard

Feature de Dashboard dinámico y tiempo real (Documento 8, apartados 8.3-8.4).

- `entities/` — `dashboard.model.ts`, `signal.model.ts`.
- `use-cases/` — `dashboard.state.ts` (suscripción WS a las Signals del Dashboard activo).
- `adapters/` — `dashboard-api.service.ts`.
- `widgets/` — un componente por `WidgetType`: `value/`, `chart/`, `gauge/`, `table/`, `alarm-list/`.
- `pages/dashboard-page/`.
- `dashboard.routes.ts`.

Se crea al implementar su spec (posterior a Auth y a la fundación backend).
