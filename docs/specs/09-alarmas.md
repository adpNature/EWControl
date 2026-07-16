# Spec: Alarmas

## Contexto

Esta spec cierra la **Fase 5** del roadmap (`README.md`, sección "Roadmap": _"Fase 5 | Feature vertical: Históricos y Alarmas | En curso"_), cuya mitad de Históricos ya quedó completada por la spec 08 ([08-historicos.md](08-historicos.md)).

El diseño arquitectónico de Alarmas ya está cerrado en los documentos base — esta spec lo implementa, no lo rediseña, mismo principio de "evolución controlada" que ya aplicaron las specs 07 y 08:

- El modelo de dominio ya está descrito ([03-modelo-de-datos.md](../03-modelo-de-datos.md), apartados 3.2.6 "AlarmDefinition" y 3.2.7 "AlarmState"): `AlarmDefinition` define la regla (Signal, operador, umbral, `AlarmPriority`, si notifica por email, si se muestra en Dashboard); `AlarmState` es el resultado de evaluarla (`AlarmStateType`: `INACTIVE`/`ACTIVE`), creado y modificado únicamente por el Alarm Engine.
- El Alarm Engine ya está descrito ([02-arquitectura.md](../02-arquitectura.md), apartado 2.8): reacciona a `SignalUpdated`, evalúa solo las `AlarmDefinition` de la Signal que cambió, solo con calidad `GOOD`, evita duplicados (una alarma activa no vuelve a disparar `AlarmTriggered` hasta resolverse) y nunca envía notificaciones — solo publica `AlarmTriggered`/`AlarmCleared`.
- El Notification Service ya está descrito ([02-arquitectura.md](../02-arquitectura.md), apartado 2.10): reacciona a esos eventos, decide si notifica según la configuración de la `AlarmDefinition`, envía por email de forma asíncrona (el Alarm Engine nunca espera el envío) y solo notifica en la transición `INACTIVE → ACTIVE` (nunca en `AlarmCleared` por defecto).
- El contrato REST ya está catalogado ([11-api-rest.md](../11-api-rest.md), secciones "AlarmDefinition" y "AlarmState"): CRUD de reglas y consulta de solo lectura de `AlarmState`; el reconocimiento manual (ACK) queda explícitamente fuera del catálogo hasta su propia spec.
- El comportamiento del Frontend ya está descrito ([08-frontend-dashboard.md](../08-frontend-dashboard.md), apartado 8.5): tres vistas (widget `ALARM_LIST`, panel de alarmas de la Company, histórico de una alarma vía REST), siempre de solo lectura — el Frontend nunca decide si algo es una alarma, solo refleja el `AlarmState` que le comunica el Backend.

Dos puntos quedaron diferidos explícitamente hacia esta spec:

1. La spec 07 admitió `WidgetType.ALARM_LIST` en el esquema pero lo dejó como estado vacío fijo, sin datos ni suscripción (`frontend/src/app/dashboard/widgets/alarm-list/alarm-list-widget.component.ts:4-8`, y [07-dashboard-tiempo-real.md](07-dashboard-tiempo-real.md), "Contexto" punto 4): _"No existen las entidades `AlarmDefinition`/`AlarmState` (spec futura de Alarmas, Fase 5)"_.
2. La spec 08 recordó explícitamente que _"Alarmas (`AlarmDefinition`/`AlarmState`, Fase 5) siguen sin implementarse"_ ([08-historicos.md](08-historicos.md), "Alcance explícito de esta spec", punto 3).

**Alcance explícito de esta spec** (principio "evolución controlada", Documento 1):

1. Se implementa el ciclo completo: CRUD de `AlarmDefinition`, evaluación continua por el Alarm Engine, trazabilidad en `AlarmState`, notificación por email (Notification Service + Email Adapter, infraestructura SMTP nueva), el widget `ALARM_LIST` real (sustituyendo su placeholder) y el panel de alarmas de la Company (`frontend/src/app/alarms/`, hoy solo `README.md` placeholder).
2. Queda fuera de alcance, por ser evolución futura ya documentada: el reconocimiento manual (ACK) de una alarma (Documento 3, apartado 3.2.7 "Evolución"; [11-api-rest.md](../11-api-rest.md):186; spec tentativa 11, que depende de esta) — el Frontend de esta spec es de solo lectura sobre `AlarmState`. También quedan fuera condiciones compuestas entre varias Signals, umbrales dinámicos y políticas de escalado (Documento 3, apartado 3.2.6 "Evolución"), y cualquier canal de notificación distinto de email (Documento 2, apartado 2.10, "Canales Disponibles": Teams, Telegram, SMS, WhatsApp, Slack, Push).
3. Una `AlarmDefinition` puede configurarse sobre una Signal `FORMULA`, pero nunca se evaluará mientras el motor de fórmulas no exista (spec 13): una Signal `FORMULA` no recibe ticks del Signal Engine, mismo criterio ya aplicado por la spec 08 a los históricos de una Signal `FORMULA`.
4. No se crea ninguna pantalla de comparativas ni el histórico independiente de Signals (spec 14, feature distinta); el histórico que introduce esta spec es exclusivamente el de `AlarmState` (activaciones/resoluciones de una alarma), ya cubierto por `GET /api/v1/alarm-states/:id`.

## Actor(es)

`User` con rol `AdminCliente` o `SuperAdmin` configura reglas de alarma (`AlarmDefinition`) sobre las Signals de su Company y consulta el estado de sus alarmas (widget `ALARM_LIST`, panel de alarmas, histórico de una alarma). El Alarm Engine y el Notification Service actúan como actores de sistema: el primero evalúa condiciones y mantiene `AlarmState`; el segundo envía las notificaciones por email.

## Precondiciones

- El usuario está autenticado con un `accessToken` válido ([05-auth-login.md](05-auth-login.md)).
- Existen Machines y Signals configuradas ([06-gestion-machines-signals.md](06-gestion-machines-signals.md)) recibiendo ticks del Signal Engine ([07-dashboard-tiempo-real.md](07-dashboard-tiempo-real.md)).
- Existe configuración SMTP vía variables de entorno (host, puerto, credenciales, remitente) para el Email Adapter — infraestructura nueva de esta spec, sin secretos hardcodeados (Documento 6, apartado 6.10, riesgo A05).

## Backend

### Flujo principal (Given/When/Then)

- **Given** un `AdminCliente` autenticado con una Signal activa de su Company.
- **When** llama a `POST /api/v1/signals/:signalId/alarm-definitions` con `{ "operator": ">"|">="|"<"|"<="|"=="|"!=", "threshold": <valor>, "priority": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "notifyByEmail": boolean, "showOnDashboard": boolean }`.
- **Then** la API responde `201` con la `AlarmDefinition` creada, activa por defecto (Documento 3, apartado 3.2.6).

- **Given** una `AlarmDefinition` activa sobre una Signal `DIRECT`, con `AlarmState` vigente `INACTIVE`, y calidad `GOOD`.
- **When** el Signal Engine (`IngestSignalTickUseCase`, ya existente desde spec 07/08) procesa un tick que cumple la condición (`value <operator> threshold`).
- **Then** el Alarm Engine, al recibir el `SignalUpdated` recién publicado, evalúa únicamente las `AlarmDefinition` de esa Signal (Documento 2, apartado 2.8, "Rendimiento"), transiciona el `AlarmState` a `ACTIVE` registrando `activatedAt`, y publica `AlarmTriggered { alarmStateId, alarmDefinitionId, signalId, priority, timestamp }`.

- **Given** un `AlarmState` vigente `ACTIVE`.
- **When** un tick posterior de la misma Signal deja de cumplir la condición.
- **Then** el Alarm Engine transiciona el `AlarmState` a `INACTIVE` registrando `resolvedAt`, y publica `AlarmCleared { alarmStateId, alarmDefinitionId, signalId, timestamp }`.

- **Given** un `AlarmState` vigente `ACTIVE`.
- **When** ticks sucesivos de la misma Signal siguen cumpliendo la condición (aunque el valor cambie).
- **Then** no se publica un nuevo `AlarmTriggered` ni se crea un nuevo `AlarmState`; solo se generará el siguiente evento cuando la alarma vuelva a `INACTIVE` y se reactive (Documento 2, apartado 2.8, "Alarmas Duplicadas").

- **Given** una `AlarmDefinition` con `notifyByEmail: true`.
- **When** se publica `AlarmTriggered` para ella.
- **Then** el Notification Service envía, de forma asíncrona y sin bloquear al Alarm Engine, un email a todos los `User` activos con rol `AdminCliente` de la Company de la Signal, con el contenido descrito en Documento 2, apartado 2.10 (Empresa, Máquina, Signal, valor, límite, fecha).

- **Given** cualquier `AlarmDefinition`.
- **When** se publica `AlarmCleared` para ella.
- **Then** no se envía ningún email por defecto (Documento 2, apartado 2.10, "Frecuencia de Envío"), únicamente se actualiza el estado.

- **Given** un `AdminCliente` autenticado.
- **When** llama a `GET /api/v1/alarm-states?status=ACTIVE&machineId=...&priority=...` (todos los filtros opcionales).
- **Then** la API responde `200` con los `AlarmState` de su propia Company que cumplen los filtros indicados.

- **Given** un `AdminCliente` autenticado con un `AlarmState` de su Company.
- **When** llama a `GET /api/v1/alarm-states/:id`.
- **Then** la API responde `200` con el detalle del `AlarmState` y el histórico completo de activaciones/resoluciones de su `AlarmDefinition` (Documento 3, apartado 3.2.7, Regla 3).

### Casos borde / errores (Given/When/Then)

- **Given** un tick con calidad `BAD`, `UNCERTAIN` u `OFFLINE`.
- **When** el Alarm Engine recibe el `SignalUpdated` correspondiente.
- **Then** la evaluación queda suspendida para esa Signal (ningún `AlarmState` cambia) hasta el próximo valor con calidad `GOOD` (Documento 2, apartado 2.8, "Calidad del Dato").

- **Given** una `AlarmDefinition` con `isActive: false`.
- **When** su Signal recibe ticks.
- **Then** el Alarm Engine no la evalúa y no genera nuevos `AlarmState` (Documento 3, apartado 3.2.6, Regla 3); su histórico previo permanece intacto y consultable.

- **Given** un operador numérico (`>`, `>=`, `<`, `<=`) y un tick cuyo valor no es numérico (Signal con valor `boolean`/`string`).
- **When** el Alarm Engine intenta evaluar la condición.
- **Then** descarta la evaluación de ese tick sin lanzar excepción ni cambiar el `AlarmState` (mismo criterio de tolerancia que la escritura de histórico, `ingest-signal-tick.use-case.ts:96`, que también exige `typeof value === 'number'`).

- **Given** un fallo del servidor SMTP al enviar la notificación.
- **When** el Notification Service intenta el envío.
- **Then** el error se registra (Pino) sin propagarse; el `AlarmState` no se reevalúa ni se reintenta el envío (Documento 2, apartado 2.10, "Gestión de Errores"; mismo principio de tolerancia a fallos que InfluxDB en spec 08).

- **Given** una petición `POST`/`PATCH` de `AlarmDefinition` con `operator` fuera de `>`, `>=`, `<`, `<=`, `==`, `!=`, `priority` fuera de `LOW`/`MEDIUM`/`HIGH`/`CRITICAL`, o `threshold` de tipo inválido.
- **When** se procesa la petición.
- **Then** la API responde `400` (`ValidationPipe` global, `whitelist: true`, `forbidNonWhitelisted: true`).

- **Given** una Signal perteneciente a otra Company, inexistente o inactiva.
- **When** un `AdminCliente` llama a `POST .../alarm-definitions` sobre ella, o a `PATCH`/`DELETE /api/v1/alarm-definitions/:id` sobre una regla de otra Company.
- **Then** la API responde `404` con `code: "SIGNAL_NOT_FOUND"` o `"ALARM_DEFINITION_NOT_FOUND"` según corresponda (nunca `403`, mismo criterio OWASP A01 que specs anteriores).

- **Given** un `AlarmState` de otra Company.
- **When** un `AdminCliente` llama a `GET /api/v1/alarm-states/:id` sobre él.
- **Then** la API responde `404` con `code: "ALARM_STATE_NOT_FOUND"`.

- **Given** una petición `GET .../alarm-states` con `status` o `priority` fuera de sus valores válidos.
- **When** se procesa la petición.
- **Then** la API responde `400`.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), secciones "AlarmDefinition" y "AlarmState" (ya catalogadas). Esta spec añade el shape de las respuestas: `AlarmDefinition` → `{ "id", "signalId", "operator", "threshold", "priority", "notifyByEmail", "showOnDashboard", "isActive" }`; `AlarmState` → `{ "id", "alarmDefinitionId", "signalId", "status": "ACTIVE"|"INACTIVE", "priority", "activatedAt", "resolvedAt" }`, y en el detalle (`GET .../alarm-states/:id`) además el listado histórico de activaciones previas de la misma `AlarmDefinition`.

### Criterios de aceptación backend

1. Un tick con calidad `GOOD` que cumple la condición de una `AlarmDefinition` activa transiciona su `AlarmState` de `INACTIVE` a `ACTIVE` y publica `AlarmTriggered` exactamente una vez por ciclo de activación, no una vez por tick.
2. Un tick que deja de cumplir la condición transiciona el `AlarmState` a `INACTIVE` y publica `AlarmCleared`.
3. Ticks con calidad distinta de `GOOD`, o de valor no comparable con un operador numérico, no alteran ningún `AlarmState`.
4. Una `AlarmDefinition` desactivada nunca genera un nuevo `AlarmState`, sin afectar a su histórico previo.
5. `AlarmTriggered` sobre una `AlarmDefinition` con `notifyByEmail: true` dispara un email asíncrono a los `AdminCliente` activos de la Company; con `notifyByEmail: false`, o ante `AlarmCleared`, no se envía ningún email.
6. Un fallo de envío de email no interrumpe el procesamiento de Signals ni dejar el `AlarmState` en un estado inconsistente.
7. `GET /alarm-states` filtra correctamente por `status`, `machineId` y `priority`, restringido siempre a la Company del usuario autenticado.
8. `GET /alarm-states/:id` devuelve el histórico completo de activaciones/resoluciones de su `AlarmDefinition`.
9. Cualquier acceso de un `AdminCliente` a una Signal, `AlarmDefinition` o `AlarmState` de otra Company responde `404`, nunca `403` ni datos ajenos.
10. Una petición de creación/edición de `AlarmDefinition` con datos fuera de los valores válidos es rechazada con `400` antes de llegar a la capa de aplicación.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `AdminCliente` en la pantalla de configuración de una Signal (`frontend/src/app/config/pages/signal-form-page/`).
- **When** crea, edita o desactiva una regla de alarma (operador, umbral, prioridad, notificar por email, mostrar en Dashboard).
- **Then** la interfaz refleja el cambio sin recargar la página, vía el nuevo endpoint de `AlarmDefinition` (Documento 8, apartado 8.6).

- **Given** un widget `ALARM_LIST` en un Dashboard, referenciando Signals con `AlarmDefinition` configuradas.
- **When** el widget se inicializa.
- **Then** solicita vía REST las `AlarmState` `ACTIVE` actuales de esas Signals, las lista con su prioridad, y a partir de ahí se actualiza en tiempo real con los eventos `AlarmTriggered`/`AlarmCleared` recibidos por WebSocket, sustituyendo el placeholder fijo de la spec 07.

- **Given** un usuario navega a la sección "Alarmas" (`frontend/src/app/alarms/`, hoy solo placeholder).
- **When** la pantalla se carga.
- **Then** muestra el panel de alarmas de toda la Company (Documento 8, apartado 8.5): lista de `AlarmState` con filtros por estado/máquina/prioridad vía REST, actualizada en tiempo real por WebSocket igual que el widget `ALARM_LIST`.

- **Given** el panel de alarmas o un widget `ALARM_LIST`.
- **When** el usuario selecciona una alarma concreta.
- **Then** se muestra su detalle: regla (`AlarmDefinition`) e histórico de activaciones/resoluciones (`GET .../alarm-states/:id`), siempre de solo lectura — sin ninguna acción de reconocimiento (ACK no existe en esta versión, Documento 8, apartado 8.5, "Interacción del Usuario").

### Casos borde / errores de UI

- **Given** un widget `ALARM_LIST` o el panel de alarmas sin alarmas activas en el filtro seleccionado.
- **When** se renderiza.
- **Then** muestra un estado vacío explícito ("sin alarmas activas"), nunca una lista en blanco ambigua.

- **Given** un fallo de red o del backend al solicitar `AlarmState`.
- **When** se produce el fallo.
- **Then** el widget o panel afectado degrada de forma aislada (mismo criterio que spec 07/08 aplicaron a `SIGNAL_VALUE_NOT_AVAILABLE` y a fallos de histórico), sin bloquear el resto del Dashboard ni de la aplicación.

- **Given** una `AlarmDefinition` con `showOnDashboard: false`.
- **When** su Signal está referenciada en un widget `ALARM_LIST`.
- **Then** sus `AlarmState` no se listan en ese widget (aunque sí en el panel de alarmas de la Company), respetando la configuración de la regla.

### Componentes/pantallas involucrados

Reemplazo de `frontend/src/app/dashboard/widgets/alarm-list/alarm-list-widget.component.ts` (placeholder de spec 07) por su implementación real. Nuevas páginas bajo `frontend/src/app/alarms/` (placeholder desde la fundación del proyecto): listado con filtros y detalle de una alarma. Extensión de `frontend/src/app/config/pages/signal-form-page/` con la gestión de `AlarmDefinition` de esa Signal. Nuevos adapters REST (`AlarmDefinitionsApiService`, `AlarmStatesApiService`) y extensión del canal WebSocket existente para consumir `AlarmTriggered`/`AlarmCleared` (Documento 11, sección "Eventos WebSocket").

### Criterios de aceptación frontend

1. Un `AdminCliente` puede crear, editar y desactivar reglas de alarma desde la configuración de una Signal.
2. El widget `ALARM_LIST` de un Dashboard muestra alarmas activas reales de sus Signals, actualizadas en tiempo real, en vez del estado vacío fijo de la spec 07.
3. El panel de alarmas (`frontend/src/app/alarms/`) lista y filtra las alarmas de toda la Company, con detalle e histórico de cada una.
4. Ninguna vista de alarmas permite una acción de reconocimiento (ACK): toda interacción es de solo lectura sobre el `AlarmState` que comunica el Backend.
5. La ausencia de alarmas activas, o un fallo de red/backend al consultarlas, se comunican siempre explícitamente, sin bloquear el resto de la interfaz.
