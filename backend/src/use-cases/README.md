# Use Cases

Capa **Use Cases** de Clean Architecture (Documento 0; equivalencia en `docs/02-arquitectura.md`).

Orquesta los casos de uso de la aplicación coordinando Entities e Interface Adapters, sin conocer frameworks concretos:

- `seed-demo-environment/` — creación idempotente del entorno demo (`docs/specs/01-fundacion-entorno-demo.md`).
- `simulator-control/` — control del Simulador vía API: forzar desconexión/calidad (`docs/specs/03-simulador-forzar-fallo.md`).
- `auth/` — Auth Service: login, refresh, logout (`docs/specs/05-auth-login.md`).
- `history/` — History Service (Documento 2, apartado 2.9).
- `alarms/` — Alarm Engine y CRUD de `AlarmDefinition`/`AlarmState` (Documento 2, apartado 2.8; `docs/specs/09-alarmas.md`).
- `notification/` — Notification Service (Documento 2, apartado 2.10; `docs/specs/09-alarmas.md`).
- `scheduler/` — Scheduler.

Regla de dependencia: puede depender de `entities/`, nunca de `interface-adapters/` ni `frameworks-drivers/` directamente (recibe sus dependencias por inyección, contra interfaces).

Cada subcarpeta se crea al implementar la spec correspondiente (`docs/specs/`), no por adelantado.
