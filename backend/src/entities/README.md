# Entities

Capa **Entities** de Clean Architecture (Documento 0; equivalencia en `docs/02-arquitectura.md`, "Equivalencia con Clean Architecture").

Contiene lógica de negocio pura, sin conocer NestJS, HTTP, PostgreSQL, InfluxDB ni ningún otro framework:

- Entidades del dominio (Documento 3): `Company`, `User`, `Machine`, `MachineConnection`, `Signal`, `AlarmDefinition`, `AlarmState`, `Dashboard`, `DashboardWidget`.
- Signal Engine, Realtime Cache y Alarm Engine (Documento 2, apartados 2.5, 2.6, 2.8).

Regla de dependencia: nada en esta carpeta importa desde `use-cases/`, `interface-adapters/` ni `frameworks-drivers/`.

Cada subcarpeta se crea al implementar la spec correspondiente (`docs/specs/`), no por adelantado.
