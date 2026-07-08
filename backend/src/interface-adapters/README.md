# Interface Adapters

Capa **Interface Adapters** de Clean Architecture (Documento 0; equivalencia en `docs/02-arquitectura.md`).

Traduce entre el mundo exterior y los Use Cases:

- `data-providers/` — contrato `IDataProvider` y sus implementaciones (`simulation/` — Documento 10; futuro `opc-ua/` — Documento 3, apartado 3.2.4).
- `persistence/postgres/` — repositorios TypeORM (`typeorm/`) y migraciones (`migrations/`).
- `persistence/influxdb/` — cliente y repositorios de InfluxDB.
- `rest/` — controladores REST (`docs/11-api-rest.md`).
- `websocket/` — gateway WebSocket (`docs/11-api-rest.md`, sección WebSocket).
- `email/` — Email Adapter (Documento 2, apartado 2.10).
- `auth-guard/` — único punto de verificación del JWT (Documento 2, "Auth Guard"; `docs/06-seguridad-global.md`).
- `security/` — hashing de contraseñas (`bcrypt-password-hasher.ts`, Documento 6 apartado 6.2).

Regla de dependencia: puede depender de `entities/`, nunca al revés.

Cada subcarpeta se crea al implementar la spec correspondiente (`docs/specs/`), no por adelantado.
