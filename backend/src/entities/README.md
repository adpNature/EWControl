# Entities

Capa **Entities** de Clean Architecture (Documento 0; equivalencia en `docs/02-arquitectura.md`, "Equivalencia con Clean Architecture").

Contiene lógica de negocio pura, sin conocer NestJS, HTTP, PostgreSQL, InfluxDB ni ningún otro framework:

- Entidades del dominio (Documento 3): `Company`, `User`, `Machine`, `MachineConnection`, `Signal`, `AlarmDefinition`, `AlarmState`, `Dashboard`, `DashboardWidget`.
- Signal Engine, Realtime Cache y Alarm Engine (Documento 2, apartados 2.5, 2.6, 2.8).
- Estado de sesión y auditoría de acceso (docs/specs/05-auth-login.md, docs/06-seguridad-global.md apartado 6.6): `RefreshToken`, `AuthAuditLog`. No forman parte del modelo de dominio de nueve entidades del Documento 3; son estado de infraestructura de seguridad transversal, colocado aquí por coherencia con el resto de entidades TypeORM.

Regla de dependencia: nada en esta carpeta importa desde `use-cases/`, `interface-adapters/` ni `frameworks-drivers/`.

Cada subcarpeta se crea al implementar la spec correspondiente (`docs/specs/`), no por adelantado.
