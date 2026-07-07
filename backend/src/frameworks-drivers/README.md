# Frameworks & Drivers

Capa **Frameworks & Drivers** de Clean Architecture (Documento 0; equivalencia en `docs/02-arquitectura.md`).

Arranque y configuración de frameworks/motores externos concretos:

- `app.module.ts` — módulo raíz de NestJS.
- `database/` — `DataSource` de TypeORM (`postgres.datasource.ts`, usado por el CLI de migraciones y por `AppModule`) y cliente de InfluxDB.
- `config/` — validación de variables de entorno.
- `logging/` — configuración de Pino (`docs/07-observabilidad-monitorizacion.md`).

Es la única capa que puede depender de todas las demás.
