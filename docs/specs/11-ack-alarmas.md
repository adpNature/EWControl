# Spec: Reconocimiento manual de alarmas (ACK)

Feature vertical (Documento 0, "Specs verticales"): cubre backend y frontend juntos.

## Contexto

La spec 09 ([09-alarmas.md](09-alarmas.md)) implementó el ciclo completo de `AlarmState` (activación/resolución por el Alarm Engine) dejando explícitamente fuera de alcance el reconocimiento manual (ACK), por ser evolución futura ya anotada en el modelo de dominio: [03-modelo-de-datos.md](../03-modelo-de-datos.md) apartado 3.2.7 ("Evolución": _"El modelo permite incorporar en el futuro el reconocimiento manual de alarmas (ACK), comentarios del operador y asignación de responsables"_), [11-api-rest.md](../11-api-rest.md):194 y [08-frontend-dashboard.md](../08-frontend-dashboard.md) apartado 8.5 ("Interacción del Usuario"), que ya adelantó la Regla 2 que esta spec debe respetar: _"El reconocimiento de una alarma desde el Frontend siempre se confirma contra el Backend antes de reflejarse como definitivo en la interfaz"_.

Esta spec formaliza esa evolución con el alcance mínimo indicado por el propio Documento 3: **quién** reconoció la alarma y **cuándo**, sin comentarios de operador ni asignación de responsables (quedan diferidos, ver "Alcance explícito").

**Refinamiento de modelo detectado al redactar esta spec**: `03-modelo-de-datos.md` apartado 3.2.7, Regla 2, dice hoy _"Un AlarmState nunca se crea ni modifica manualmente"_. Esa regla seguía protegiendo el ciclo de vida (`status`/`activatedAt`/`resolvedAt`), que continúa siendo responsabilidad exclusiva del Alarm Engine; el ACK añade una excepción puntual y ya prevista por el propio documento, no una contradicción: un User autorizado puede establecer los nuevos campos `ackedAt`/`ackedByUserId`/`ackedByEmail` de un `AlarmState` existente, exactamente una vez por activación, sin poder alterar `status`, `activatedAt` ni `resolvedAt`. Esta spec actualiza la Regla 2 y añade los nuevos campos a la sección "Responsabilidades" del Documento 3 en el mismo PR que la implementa.

## Actor(es)

`User` con rol `AdminCliente` (alarmas de su propia Company) o `SuperAdmin` (alarmas de cualquier Company) reconoce una alarma. El Alarm Engine y el Notification Service no participan en este flujo (no hay reenvío de notificaciones ni escalado que el ACK deba silenciar, Documento 2 apartado 2.10).

## Precondiciones

- El usuario está autenticado con un `accessToken` válido ([05-auth-login.md](05-auth-login.md)).
- Existe al menos un `AlarmState` visible para el usuario (spec 09), en cualquier `status` (`ACTIVE` o `INACTIVE`).

## Backend

### Flujo principal (Given/When/Then)

- **Given** un `AdminCliente` autenticado con un `AlarmState` de su Company, aún no reconocido (`ackedAt: null`).
- **When** llama a `POST /api/v1/alarm-states/:id/ack` (sin body).
- **Then** la API responde `200` con el `AlarmState` actualizado: `ackedAt` (fecha/hora del servidor), `ackedByUserId` (id del requester) y `ackedByEmail` (email del requester en el momento del ACK, denormalizado igual criterio que `AlarmState.priority` ya denormaliza `AlarmDefinition.priority`, `alarm-state.entity.ts:43`, para no depender de un join al listar). El resto de campos (`status`, `activatedAt`, `resolvedAt`) no cambian.

- **Given** un `AlarmState` reconocido.
- **When** se publica el resultado del ACK.
- **Then** el backend emite por WebSocket el evento `AlarmAcked { alarmStateId, alarmDefinitionId, signalId, ackedByUserId, ackedByEmail, ackedAt }` a los clientes de la misma Company, mismo canal que `AlarmTriggered`/`AlarmCleared` (Documento 11, sección "Eventos WebSocket"), para que cualquier otro usuario viendo el mismo panel/widget vea el reconocimiento sin recargar.

- **Given** un `AlarmState` con `status: "INACTIVE"` (ya resuelto) y sin reconocer.
- **When** un `AdminCliente` o `SuperAdmin` con acceso llama a `POST .../ack`.
- **Then** la API responde igualmente `200`: el ACK no exige que la alarma siga activa (permite revisar y dejar constancia de alarmas ya resueltas).

- **Given** un `SuperAdmin` autenticado.
- **When** llama a `POST /api/v1/alarm-states/:id/ack` sobre un `AlarmState` de cualquier Company.
- **Then** la API responde `200` (mismo criterio de acceso sin restricción de Company que el resto de endpoints de `AlarmState`, `alarm-state-access.resolver.ts:56`).

### Casos borde / errores (Given/When/Then)

- **Given** un `AlarmState` ya reconocido (`ackedAt` no nulo).
- **When** se llama de nuevo a `POST .../ack` sobre él (doble clic, reintento de red, u otro usuario).
- **Then** la API responde `200` sin modificar `ackedAt`/`ackedByUserId`/`ackedByEmail` (operación idempotente, mismo criterio que `POST .../reactivate` en [10-gestion-companies-users.md](10-gestion-companies-users.md); se preserva quién reconoció primero, no se sobreescribe el ACK).

- **Given** un `AlarmState` de otra Company, o un `id` inexistente.
- **When** un `AdminCliente` llama a `POST .../ack` sobre él.
- **Then** la API responde `404` con `code: "ALARM_STATE_NOT_FOUND"` (nunca `403`, mismo criterio 404-siempre que el resto de `AlarmState`, Documento 6 apartado 6.7).

- **Given** un `AdminCliente` sin acceso al `AlarmState` indicado.
- **When** intenta enumerar ids por fuerza bruta contra `POST .../ack`.
- **Then** cada intento sobre un recurso ajeno responde `404` en tiempo equivalente al de un id inexistente, sin filtrar si el `id` corresponde a una alarma real de otra Company (Documento 6 apartado 6.10, OWASP A01).

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección "AlarmState" (esta spec añade la fila `POST /api/v1/alarm-states/:id/ack` y retira la nota de "solo lectura, sin endpoints de escritura"). Sin body de petición. Respuesta `200`: mismo shape que `GET /alarm-states/:id` (`{ "id", "alarmDefinitionId", "signalId", "status", "priority", "activatedAt", "resolvedAt", "ackedAt", "ackedByUserId", "ackedByEmail" }`, más `history` en el detalle), con `ackedAt`/`ackedByUserId`/`ackedByEmail` a `null` mientras no se haya reconocido.

### Criterios de aceptación backend

1. `POST /alarm-states/:id/ack` establece `ackedAt` (fecha del servidor), `ackedByUserId` y `ackedByEmail` (del requester) en un `AlarmState` no reconocido previamente, sin alterar `status`, `activatedAt` ni `resolvedAt`.
2. La operación es idempotente: repetirla sobre un `AlarmState` ya reconocido responde `200` sin sobreescribir el ACK existente.
3. El ACK es posible tanto sobre un `AlarmState` `ACTIVE` como `INACTIVE`.
4. Un `AdminCliente` solo puede reconocer alarmas de su propia Company; cualquier otra responde `404 ALARM_STATE_NOT_FOUND`. Un `SuperAdmin` puede reconocer alarmas de cualquier Company.
5. Tras un ACK exitoso, se publica `AlarmAcked` por WebSocket a los clientes de la Company correspondiente, con el mismo criterio de aislamiento que `AlarmTriggered`/`AlarmCleared`.
6. El ACK no crea una fila nueva de `AlarmState` ni interactúa con el Alarm Engine o el Notification Service (no hay reenvío de notificaciones que silenciar en esta versión).

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `AdminCliente` o `SuperAdmin` en el detalle de una alarma (`frontend/src/app/alarms/pages/alarm-detail-page/`) sin reconocer.
- **When** pulsa el botón "Reconocer".
- **Then** la app llama a `POST /api/v1/alarm-states/:id/ack`; al confirmar el Backend (`200`), el botón se sustituye por "Reconocida por `{ackedByEmail}` el `{ackedAt}`" (Documento 8, apartado 8.5, Regla 2: nunca se marca como reconocida antes de la confirmación del Backend).

- **Given** el panel de alarmas (`frontend/src/app/alarms/pages/alarm-panel-page/`) con alarmas sin reconocer en la lista.
- **When** el usuario pulsa la acción "Reconocer" de una fila.
- **Then** la app llama al mismo endpoint y actualiza esa fila en la lista sin recargar la página, igual criterio de actualización local que el resto de acciones de la spec 10 (`reactivate`).

- **Given** un `AlarmState` ya reconocido, visible en el panel o el detalle.
- **When** se renderiza.
- **Then** se muestra quién lo reconoció y cuándo, y la acción "Reconocer" desaparece (no se puede reconocer dos veces desde la UI, aunque el Backend sea idempotente).

- **Given** otro usuario de la misma Company con el panel de alarmas abierto en ese momento.
- **When** alguien reconoce esa misma alarma desde otra sesión.
- **Then** el evento `AlarmAcked` recibido por WebSocket actualiza la fila en tiempo real, igual que ya ocurre con `AlarmTriggered`/`AlarmCleared` (spec 09).

### Casos borde / errores de UI

- **Given** un fallo de red o del backend al llamar a `POST .../ack`.
- **When** se produce el fallo.
- **Then** el botón "Reconocer" permanece visible (la acción no se da por hecha) y se muestra un mensaje de error, sin bloquear el resto de la pantalla.

- **Given** dos usuarios pulsando "Reconocer" sobre la misma alarma casi simultáneamente.
- **When** ambas peticiones llegan al Backend.
- **Then** ambas reciben `200` (idempotencia backend); la UI de quien no "ganó" el ACK termina mostrando igualmente el resultado real (`ackedByEmail` del primero) tras la respuesta o el evento `AlarmAcked`, nunca su propio nombre si no fue quien reconoció primero.

- **Given** el widget `ALARM_LIST` de un Dashboard.
- **When** se muestra una alarma reconocida o sin reconocer.
- **Then** el widget sigue siendo de solo lectura (glance view compacto, Documento 8 apartado 8.5): no ofrece la acción "Reconocer"; para reconocer, el usuario navega al panel de alarmas o al detalle (decisión explícita de esta spec, ver "Alcance explícito").

### Componentes/pantallas involucrados

Extiende `frontend/src/app/alarms/pages/alarm-detail-page/` (botón "Reconocer" / estado reconocido) y `frontend/src/app/alarms/pages/alarm-panel-page/` (acción "Reconocer" en `alarmStateActions`, nueva columna con el estado de reconocimiento). Extiende `frontend/src/app/alarms/entities/alarm-state.model.ts` (`ackedAt`, `ackedByUserId`, `ackedByEmail`), `frontend/src/app/alarms/adapters/alarm-states-api.service.ts` (nuevo método `ack(id)`) y `frontend/src/app/alarms/use-cases/alarm-states.state.ts` (aplicar la actualización local tras el ACK y ante el evento `AlarmAcked` por WebSocket). No se modifica `frontend/src/app/dashboard/widgets/alarm-list/` (permanece de solo lectura).

### Criterios de aceptación frontend

1. Un `AdminCliente`/`SuperAdmin` con acceso a una alarma puede reconocerla desde el panel de alarmas o desde su detalle.
2. La UI nunca muestra una alarma como reconocida antes de recibir la confirmación `200` del Backend.
3. Una alarma reconocida muestra quién la reconoció y cuándo, y oculta la acción "Reconocer".
4. Un fallo de red/backend al reconocer se comunica explícitamente y no deja el botón "Reconocer" oculto sin haberse confirmado.
5. El evento `AlarmAcked` recibido por WebSocket actualiza en tiempo real cualquier vista abierta que muestre esa alarma, igual que ya ocurre con `AlarmTriggered`/`AlarmCleared`.
6. El widget `ALARM_LIST` del Dashboard no ofrece la acción "Reconocer" (permanece de solo lectura).

## Alcance explícito de esta spec

1. Se implementa únicamente **quién** y **cuándo** reconoció una alarma (`ackedAt`, `ackedByUserId`, `ackedByEmail`), vía `POST /api/v1/alarm-states/:id/ack`, con reflejo en el panel de alarmas, el detalle de alarma y el evento WebSocket `AlarmAcked`.
2. Quedan fuera de alcance, por ser evolución futura ya documentada (Documento 3, apartado 3.2.7, "Evolución"): comentarios del operador sobre una alarma y asignación de responsables — no hay campo de texto libre ni de reasignación en esta versión.
3. El widget `ALARM_LIST` del Dashboard no incorpora la acción de reconocimiento (permanece un glance view de solo lectura); reconocer una alarma requiere navegar al panel de alarmas o a su detalle.
4. No se añade ninguna entrada al log de auditoría (`auth_audit_log`, que hoy cubre solo autenticación, Documento 6 apartado 6.10): el propio `AlarmState` ya guarda `ackedAt`/`ackedByUserId`/`ackedByEmail` como registro de quién y cuándo, sin necesidad de una tabla de auditoría separada — mismo alcance de trazabilidad mínima que las bajas lógicas de la spec 10, pero superior en este caso porque el rastro vive en la propia entidad.
5. El ACK no interactúa con el Notification Service: no existen notificaciones repetidas ni escalado por prioridad en esta versión (Documento 2, apartado 2.10), por lo que no hay nada que un ACK deba silenciar.
