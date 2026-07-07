# Use Cases

Capa **Use Cases** de Clean Architecture (Documento 0; equivalencia en `docs/02-arquitectura.md`).

Orquesta los casos de uso de la aplicación coordinando Entities e Interface Adapters, sin conocer frameworks concretos:

- `auth/` — Auth Service: login, refresh, logout (`docs/specs/auth-login.md`).
- `history/` — History Service (Documento 2, apartado 2.9).
- `notification/` — Notification Service (Documento 2, apartado 2.10).
- `scheduler/` — Scheduler.

Regla de dependencia: puede depender de `entities/`, nunca de `interface-adapters/` ni `frameworks-drivers/` directamente (recibe sus dependencias por inyección, contra interfaces).

Cada subcarpeta se crea al implementar la spec correspondiente (`docs/specs/`), no por adelantado.
