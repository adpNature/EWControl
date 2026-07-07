# Core

Infraestructura transversal del Frontend (Documento 8, apartado 8.2; Documento 0, "Equivalencia con Clean Architecture" en `docs/08-frontend-dashboard.md`):

- `guards/` — `AuthGuard` de rutas (Interface Adapter).
- `interceptors/` — interceptor de refresh automático de token (`docs/specs/auth-login.md`).
- `http/` — wrapper fino sobre `HttpClient` (base URL `/api/v1`, envelope de error de `docs/11-api-rest.md`).
- `websocket/` — canal WebSocket único (eventos `SignalUpdated`, `AlarmTriggered`... de `docs/11-api-rest.md`).
- `state/` — estado de sesión/usuario actual (Use Case transversal, con `signal()`).

Cada subcarpeta se crea al implementar la spec correspondiente, no por adelantado.
