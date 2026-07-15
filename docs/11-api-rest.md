# 11. API REST

## Introducción

Este documento define el contrato de la API HTTP y WebSocket de EWControl: el punto de entrada único tanto para el Frontend (Angular) como para cualquier otro cliente futuro.

Hasta este documento, ninguna versión de la documentación definía un catálogo de endpoints. El Documento 3 (apartado "Relación con el resto de la documentación") referenciaba un "Documento 6 — API REST" que nunca llegó a existir con ese contenido; este documento lo sustituye. La corrección de esa referencia cruzada se aplica en el propio Documento 3.

El catálogo se apoya directamente en el modelo de dominio (Documento 3) y en la arquitectura en capas (Documento 2): cada endpoint es la puerta de entrada de un Adapter REST hacia un caso de uso de la capa de aplicación.

---

## Convenciones Globales

### Base URL y versionado

```
/api/v1/
```

Todo cambio incompatible de contrato incrementa la versión (`/api/v2/`); los cambios compatibles (nuevos campos opcionales, nuevos endpoints) no la incrementan.

### Formato

Request y response en JSON (`Content-Type: application/json`). No se usa ningún envoltorio tipo JSON:API.

### Paginación

Los endpoints de listado aceptan `?limit=&offset=` (por defecto `limit=20`, máximo `100`) y devuelven:

```json
{
  "data": [/* ... */],
  "total": 137,
  "limit": 20,
  "offset": 0
}
```

### Errores

Formato uniforme para cualquier error 4xx/5xx:

```json
{
  "code": "MACHINE_NOT_FOUND",
  "message": "No existe la máquina solicitada.",
  "details": null
}
```

`code` es estable y machine-readable (para que el frontend pueda reaccionar sin parsear `message`). `message` es legible por humanos. `details` es opcional, para errores de validación por campo.

### Validación de payloads

Todo DTO de entrada se valida con **`class-validator`** + **`class-transformer`**, a través de un `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`): es la combinación idiomática de NestJS, ya integrada en el framework sin dependencias adicionales, y `whitelist`/`forbidNonWhitelisted` rechazan automáticamente cualquier campo no declarado en el DTO, cerrando por defecto una vía de Mass Assignment (OWASP A04, Documento 6). Un payload que falle esta validación responde `400` con `details` listando el campo y la regla incumplida.

| HTTP status | Uso                                                    |
| ----------- | ------------------------------------------------------ |
| 400         | Payload inválido / mal formado                         |
| 401         | Falta token o token inválido/expirado                  |
| 403         | Token válido pero sin permiso sobre el recurso         |
| 404         | Recurso no encontrado (o perteneciente a otra Company) |
| 409         | Conflicto (ej. email duplicado)                        |
| 422         | Validación de negocio fallida                          |
| 500         | Error no controlado                                    |

### Autenticación

Todo endpoint requiere un JWT válido en `Authorization: Bearer <token>`, salvo los de `Auth` (login/refresh). El detalle del esquema JWT (algoritmo, expiración, refresh) está en [06-seguridad-global.md](06-seguridad-global.md).

### Aislamiento multiempresa

Todo endpoint que devuelva o modifique datos de negocio filtra automáticamente por el `company_id` del usuario autenticado, salvo que su rol sea `SuperAdmin` (Documento 6, apartado 6.7). Un `AdminCliente` nunca puede acceder, ni siquiera leer, un recurso de otra Company: la respuesta es `404`, no `403`, para no confirmar la existencia del recurso.

---

## Auth

Ver spec completa en [docs/specs/05-auth-login.md](specs/05-auth-login.md). El auto-servicio de recuperación de contraseña está catalogado aquí y especificado en [docs/specs/10-gestion-companies-users.md](specs/10-gestion-companies-users.md).

| Método | Ruta                           | Descripción                                                                                                                         |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/auth/login`           | Autentica con email/contraseña. Devuelve `accessToken` y `refreshToken`.                                                            |
| POST   | `/api/v1/auth/refresh`         | Cambia un `refreshToken` válido por un nuevo `accessToken` (y rota el `refreshToken`).                                              |
| POST   | `/api/v1/auth/logout`          | Invalida el `refreshToken` actual.                                                                                                  |
| POST   | `/api/v1/auth/forgot-password` | Solicita un enlace de recuperación de contraseña por email. Respuesta idéntica exista o no el email (evita enumeración, OWASP A07). |
| POST   | `/api/v1/auth/reset-password`  | Establece una nueva contraseña a partir de un token de recuperación de un solo uso.                                                 |

---

## Company

Solo accesible por `SuperAdmin` (una Company se crea al dar de alta un cliente, Documento 3 apartado 3.2.1). Ver spec completa en [docs/specs/10-gestion-companies-users.md](specs/10-gestion-companies-users.md).

| Método | Ruta                               | Descripción                                                                                                             |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/companies`                | Lista todas las Companies (activas e inactivas).                                                                        |
| GET    | `/api/v1/companies/:id`            | Detalle de una Company.                                                                                                 |
| POST   | `/api/v1/companies`                | Crea una Company.                                                                                                       |
| PATCH  | `/api/v1/companies/:id`            | Actualiza una Company.                                                                                                  |
| DELETE | `/api/v1/companies/:id`            | Baja lógica de una Company.                                                                                             |
| POST   | `/api/v1/companies/:id/reactivate` | Reactiva una Company dada de baja.                                                                                      |
| DELETE | `/api/v1/companies/:id/purge`      | Borrado físico e irreversible de la Company junto con sus Users, Machines, Signals, Dashboards e histórico en InfluxDB. |

---

## User

Ver spec completa en [docs/specs/10-gestion-companies-users.md](specs/10-gestion-companies-users.md).

| Método | Ruta                           | Descripción                                                                                       |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/users`                | Lista los Users de la Company del usuario autenticado, activos e inactivos (`SuperAdmin`: todos). |
| GET    | `/api/v1/users/:id`            | Detalle de un User (activo o inactivo).                                                           |
| POST   | `/api/v1/users`                | Crea un User dentro de la Company (rol `AdminCliente` o `SuperAdmin`).                            |
| PATCH  | `/api/v1/users/:id`            | Actualiza un User.                                                                                |
| DELETE | `/api/v1/users/:id`            | Baja lógica de un User (invalida sus refresh tokens, Documento 6).                                |
| POST   | `/api/v1/users/:id/reactivate` | Reactiva un User dado de baja.                                                                    |
| PATCH  | `/api/v1/users/me/password`    | Cambia la contraseña del propio usuario autenticado (requiere la contraseña actual).              |

---

## Machine

| Método | Ruta                   | Descripción                       |
| ------ | ---------------------- | --------------------------------- |
| GET    | `/api/v1/machines`     | Lista las Machines de la Company. |
| GET    | `/api/v1/machines/:id` | Detalle de una Machine.           |
| POST   | `/api/v1/machines`     | Crea una Machine.                 |
| PATCH  | `/api/v1/machines/:id` | Actualiza una Machine.            |
| DELETE | `/api/v1/machines/:id` | Baja lógica de una Machine.       |

---

## MachineConnection

Se gestiona siempre en el contexto de su Machine (Documento 3: relación 1 a 1).

| Método | Ruta                                     | Descripción                                                                                                                   |
| ------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/machines/:machineId/connection` | Configuración de conexión de la Machine.                                                                                      |
| PUT    | `/api/v1/machines/:machineId/connection` | Reemplaza `ProviderType` + `ConnectionConfig` de la Machine (ej. pasar de `Simulator` a `OpcUa`, Documento 10 apartado 10.7). |

### Endpoints de control del Simulador

Solo aplicables cuando `ProviderType = Simulator` (Documento 10). Devuelven `422` si la Machine usa otro proveedor.

| Método | Ruta                                                     | Descripción                                                                                                                       |
| ------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/machines/:machineId/simulator/force-disconnect` | Fuerza una desconexión simulada (Documento 10, apartado 10.5).                                                                    |
| POST   | `/api/v1/machines/:machineId/simulator/reconnect`        | Revierte la desconexión forzada.                                                                                                  |
| POST   | `/api/v1/machines/:machineId/simulator/force-quality`    | Body: `{ "signalId": "...", "quality": "BAD" \| "UNCERTAIN", "durationTicks": 10 }`. Degrada la calidad de una Signal N lecturas. |
| POST   | `/api/v1/machines/:machineId/simulator/seed-history`     | Dispara el pre-poblado de histórico (Documento 10, apartado 10.6) para esta Machine.                                              |

---

## Signal

| Método | Ruta                                              | Descripción                                                                                                               |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/machines/:machineId/signals`             | Lista las Signals de una Machine.                                                                                         |
| GET    | `/api/v1/machines/:machineId/signals/:id`         | Detalle de una Signal.                                                                                                    |
| POST   | `/api/v1/machines/:machineId/signals`             | Crea una Signal (`SignalType`: `DIRECT` o `FORMULA`, Documento 3 apartado 3.2.5).                                         |
| PATCH  | `/api/v1/machines/:machineId/signals/:id`         | Actualiza una Signal.                                                                                                     |
| DELETE | `/api/v1/machines/:machineId/signals/:id`         | Elimina una Signal.                                                                                                       |
| GET    | `/api/v1/machines/:machineId/signals/:id/value`   | Valor actual desde la Realtime Cache (Documento 2, apartado 2.6).                                                         |
| GET    | `/api/v1/machines/:machineId/signals/:id/history` | Histórico. Query: `from`, `to` (ISO 8601), `resolution` opcional (`raw`, `minute`, `hour`, `day`, `month` — Documento 4). |

Respuesta de `GET .../history` (spec 08, [08-historicos.md](specs/08-historicos.md)): `200` con `{ "signalId": string, "resolution": string, "points": [{ "timestamp": string, "value": number }] }`. Si se omite `resolution`, el Backend la infiere del span `to - from` (Documento 4 §4.3, Documento 8 §8.7: el Frontend nunca elige la resolución); si se indica explícitamente, se respeta tal cual. Sin datos en el rango (Signal `FORMULA`, sin histórico habilitado, o rango vacío) responde `200` con `points: []`, nunca un error.

---

## AlarmDefinition

| Método | Ruta                                          | Descripción                                                                                    |
| ------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/signals/:signalId/alarm-definitions` | Lista las reglas de alarma de una Signal.                                                      |
| POST   | `/api/v1/signals/:signalId/alarm-definitions` | Crea una regla (operador, umbral, `AlarmPriority`).                                            |
| PATCH  | `/api/v1/alarm-definitions/:id`               | Actualiza una regla.                                                                           |
| DELETE | `/api/v1/alarm-definitions/:id`               | Desactiva una regla (Documento 3, Regla 3: una regla desactivada no genera nuevos AlarmState). |

---

## AlarmState

Su ciclo de vida (`status`/`activatedAt`/`resolvedAt`) únicamente lo crea o modifica el Alarm Engine (Documento 3, apartado 3.2.7, Regla 1); el único endpoint de escritura es el reconocimiento manual (ACK, spec 11), que no altera ese ciclo de vida.

| Método | Ruta                           | Descripción                                                                                                 |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/alarm-states`         | Lista alarmas de la Company. Query: `status` (`ACTIVE`/`INACTIVE`), `machineId`, `priority`.                |
| GET    | `/api/v1/alarm-states/:id`     | Detalle de un AlarmState, incluyendo histórico de activaciones de su AlarmDefinition.                       |
| POST   | `/api/v1/alarm-states/:id/ack` | Reconoce manualmente la alarma (ACK): fija `ackedAt`/`ackedByUserId`/`ackedByEmail`. Idempotente (spec 11). |

---

## Dashboard / DashboardWidget

| Método | Ruta                                       | Descripción                                                                     |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------- |
| GET    | `/api/v1/dashboards`                       | Lista los Dashboards de la Company.                                             |
| GET    | `/api/v1/dashboards/:id`                   | Detalle de un Dashboard, con sus widgets.                                       |
| POST   | `/api/v1/dashboards`                       | Crea un Dashboard.                                                              |
| PATCH  | `/api/v1/dashboards/:id`                   | Renombra / reordena un Dashboard.                                               |
| DELETE | `/api/v1/dashboards/:id`                   | Elimina un Dashboard.                                                           |
| POST   | `/api/v1/dashboards/:id/widgets`           | Añade un DashboardWidget (`WidgetType`, `WidgetConfig`, Signals referenciadas). |
| PATCH  | `/api/v1/dashboards/:id/widgets/:widgetId` | Actualiza un widget.                                                            |
| DELETE | `/api/v1/dashboards/:id/widgets/:widgetId` | Elimina un widget.                                                              |

---

## WebSocket

Canal: `wss://.../api/v1/realtime` (namespace de Socket.IO, [07-dashboard-tiempo-real.md](specs/07-dashboard-tiempo-real.md)). El cliente autentica el handshake enviando el `accessToken` JWT (mismo token que en REST) en el objeto `auth` del handshake de Socket.IO (`io(url, { auth: { token } })`), con fallback a query param `?token=`; una conexión sin token válido se rechaza al conectar.

Tras conectar, el cliente recibe únicamente eventos de Machines/Signals de su propia Company (mismo aislamiento multiempresa que en REST).

Eventos publicados por el backend (ya descritos como eventos internos en Documento 2, apartado "Sistema de Eventos"; aquí se formalizan como contrato público hacia el Frontend):

| Evento                | Payload                                                                               | Descripción                                               |
| --------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `SignalUpdated`       | `{ signalId, machineId, value, quality, timestamp }`                                  | Una Signal ha sido actualizada en la Realtime Cache.      |
| `MachineConnected`    | `{ machineId, timestamp }`                                                            | La máquina ha establecido conexión.                       |
| `MachineDisconnected` | `{ machineId, timestamp }`                                                            | La máquina ha perdido la comunicación.                    |
| `AlarmTriggered`      | `{ alarmStateId, alarmDefinitionId, signalId, priority, timestamp }`                  | Se ha activado una alarma.                                |
| `AlarmCleared`        | `{ alarmStateId, alarmDefinitionId, signalId, timestamp }`                            | Una alarma ha vuelto a estado normal.                     |
| `AlarmAcked`          | `{ alarmStateId, alarmDefinitionId, signalId, ackedByUserId, ackedByEmail, ackedAt }` | Una alarma ha sido reconocida manualmente (ACK, spec 11). |

El cliente no publica eventos de negocio por WebSocket: toda escritura se hace vía REST. El WebSocket es unidireccional (servidor → cliente).

---

## Decisión Arquitectónica

El catálogo cubre el CRUD completo de las nueve entidades del dominio (Documento 3) más los endpoints de control específicos del Simulador (Documento 10), incluyendo `Dashboard`/`DashboardWidget` aunque el Frontend que los consume se desarrolle como features verticales incrementales (Documento 0). Definir ya esta API evita tener que rediseñar contratos cuando cada feature vertical llegue a su turno de implementación.
