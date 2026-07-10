# Auth

Feature de autenticación (`docs/specs/05-auth-login.md`), primera feature vertical del proyecto.

- `entities/` — `user.model.ts`, `auth-session.model.ts` (interfaces TS puras, sin imports de Angular).
- `use-cases/` — `auth.state.ts` (`AuthStateService`: signals `currentUser`/`accessToken`, `computed isAuthenticated`, `login()`/`logout()`/`refresh()`/`initializeSession()`) y `decode-access-token.ts`. Es también el único lugar del Frontend con estado de sesión — el resto de features futuras lo importan directamente desde aquí, sin duplicarlo en `core/state/`.
- `adapters/` — `auth-api.service.ts` (`POST /auth/login`, `/refresh`, `/logout`).
- `pages/login-page/` — pantalla de login (`login-page.ts/html/scss`, `login-error-message.ts`).
- `auth.routes.ts` — rutas lazy de la feature.

Implementada en `docs/specs/05-auth-login.md`.
