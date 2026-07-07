# Auth

Feature de autenticación (`docs/specs/auth-login.md`), primera feature vertical del proyecto.

- `entities/` — `user.model.ts` (interfaz TS pura, sin imports de Angular).
- `use-cases/` — `auth.state.ts` (`signal(currentUser)`, `computed(isAuthenticated)`, `login()`/`logout()`).
- `adapters/` — `auth-api.service.ts` (`POST /auth/login`, `/refresh`, `/logout`).
- `pages/login-page/` — pantalla de login.
- `auth.routes.ts` — rutas lazy de la feature.

Se crea al implementar la spec.
