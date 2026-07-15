# Core

Infraestructura transversal del Frontend (Documento 8, apartado 8.2; Documento 0, "Equivalencia con Clean Architecture" en `docs/08-frontend-dashboard.md`):

- `guards/` — `authGuard`/`superAdminGuard` de rutas (Interface Adapter, `docs/specs/05-auth-login.md`, `docs/specs/10-gestion-companies-users.md`).
- `interceptors/` — `authInterceptor`: adjunta el access token y dispara el refresh automático de token en un `401` (`docs/specs/05-auth-login.md`).
- `http/` — `ApiService`, wrapper fino sobre `HttpClient` (base URL `/api/v1`, envelope de error `ApiError` de `docs/11-api-rest.md`).
- `websocket/` — canal WebSocket único (eventos `SignalUpdated`, `AlarmTriggered`... de `docs/11-api-rest.md`). Pendiente, llega con la spec de Dashboard.
- `layout/` — `AppShellComponent` (layout route de la zona privada) y `SidebarComponent` + `SidebarCollapseState` (`docs/specs/12-navegacion-shell.md`).
- `storage/` — `LocalStorageService`, wrapper fino sobre `window.localStorage` (`docs/specs/12-navegacion-shell.md`); no confundir con el `accessToken`, que nunca vive aquí.

No hay `state/`: el estado de sesión vive en `auth/use-cases/auth.state.ts` (`AuthStateService`), no aquí — ver `auth/README.md`.

Cada subcarpeta pendiente se crea al implementar la spec correspondiente, no por adelantado.
