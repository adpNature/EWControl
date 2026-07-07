# Spec: Fundación del entorno demo (Company, User, Machine, Signals)

> Sin Frontend: es una funcionalidad de fundación, ejecutada como script de seed, sin pantalla propia. Ver [00-metodologia-y-calidad.md](../00-metodologia-y-calidad.md).

## Contexto

Las specs `simulador-generar-lectura.md`, `simulador-forzar-fallo.md` y `simulador-seed-historico.md` asumen que ya existe una Machine demo con sus Signals configuradas (Documento 10, apartado 10.2). Ninguna spec anterior cubre cómo se crea esa Machine, ni el `User`/`Company` de prueba documentados en el README (sección f). Esta spec cierra ese hueco y es, en la práctica, el primer caso de uso que se implementa del proyecto.

## Actor(es)

Sistema, disparado por el comando `pnpm run seed` (README, sección c) al levantar el entorno de desarrollo por primera vez.

## Precondiciones

- PostgreSQL accesible y con las migraciones de TypeORM ya aplicadas (Documento 4, "Convenciones de Persistencia").
- Ninguna Company/User/Machine previa con los mismos identificadores de seed (ver idempotencia más abajo).

## Backend

### Flujo principal (Given/When/Then)

- **Given** una base de datos con el esquema migrado y vacía.
- **When** se ejecuta `pnpm run seed`.
- **Then** se crea, en una única transacción:
  1. Una `Company` demo (`name: "EWControl Demo"`).
  2. Un `User` con `email: "demo@ewcontrol.local"`, `role: AdminCliente`, contraseña `Demo1234!` hasheada con bcrypt (Documento 6, apartado 6.2), asociado a la Company anterior.
  3. Una `Machine` (`name: "Bobinadora Demo 1"`) perteneciente a esa Company.
  4. Una `MachineConnection` para esa Machine con `ProviderType = Simulator` y el `ConnectionConfig` seed descrito en el Documento 10, apartado 10.3 (`seedProfile: "bobinadora-energia-v1"`).
  5. Las Signals `DIRECT` correspondientes a esa seed (`WindingSpeed`, `ThreadTension`, `MotorTemperature`, `MotorCurrent`, `PieceCounter`, `RunStop`), cada una vinculada a la Machine anterior.

- **Given** el seed anterior ya se ejecutó con éxito.
- **When** se llama a `POST /api/v1/machines/:machineId/simulator/seed-history` (spec `simulador-seed-historico.md`).
- **Then** la Machine recién creada ya tiene histórico pre-poblado, quedando el entorno demo completamente utilizable de principio a fin.

### Casos borde / errores (Given/When/Then)

- **Given** el seed ya se ejecutó previamente (existe una Company con el mismo nombre de seed).
- **When** se vuelve a ejecutar `pnpm run seed`.
- **Then** el comando es idempotente: no crea entidades duplicadas y termina con éxito, informando que el entorno demo ya existía.

- **Given** un fallo a mitad de la creación (ej. la base de datos se desconecta tras crear la Company pero antes de crear la Machine).
- **When** ocurre el error.
- **Then** toda la operación se revierte (transacción única): no queda una Company sin User, ni una Machine sin Signals.

- **Given** las migraciones de TypeORM no se han aplicado todavía.
- **When** se ejecuta `pnpm run seed`.
- **Then** el comando falla con un mensaje explícito indicando que faltan migraciones por aplicar, sin intentar crear datos sobre un esquema inexistente.

### Contrato de entrada/salida

No es un endpoint HTTP: es un script de utilidad de desarrollo (`pnpm run seed`, README sección c), no forma parte del catálogo de `docs/11-api-rest.md`. Usa directamente los mismos repositorios/entidades que expondrán después los endpoints de `Company`, `User`, `Machine`, `MachineConnection` y `Signal` del Documento 11.

### Criterios de aceptación backend

1. Tras ejecutar `pnpm run seed` sobre una base de datos vacía y migrada, existen exactamente una Company, un User, una Machine, una MachineConnection y seis Signals, con los valores descritos en el flujo principal.
2. El usuario `demo@ewcontrol.local` puede autenticarse con éxito contra `POST /api/v1/auth/login` (spec `auth-login.md`) usando la contraseña `Demo1234!`.
3. La contraseña se almacena hasheada con bcrypt, nunca en texto plano.
4. Ejecutar el comando dos veces no duplica ninguna entidad.
5. Un fallo a mitad de la operación no deja datos parciales (Company sin User, Machine sin Signals, etc.).
6. Tras el seed, `simulador-generar-lectura.md` puede ejecutarse sin ninguna configuración adicional sobre la Machine creada.
