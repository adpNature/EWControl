# Spec: Dashboard en tiempo real

## Contexto

Hoy el Simulador genera lecturas periódicas que nadie consume: `SimulationProvider.tick()` (`backend/src/interface-adapters/data-providers/simulation/simulation-provider.ts`) construye una `Variable` por cada señal simulada y la entrega a `this.listeners`, pero `SimulationProviderRegistry.onModuleInit()` nunca llama a `subscribe()` en producción — cada lectura se genera y se descarta inmediatamente. No existe Signal Engine, no existe Realtime Cache y no existe WebSocket Gateway, aunque los tres ya están descritos como parte de la capa Domain/Entities en el Documento 2 (apartado 2.2, "Equivalencia con Clean Architecture": "Domain (Signal Engine, Realtime Cache, Alarm Engine; entidades del Documento 3) → Entities"). Tampoco existen las entidades `Dashboard` ni `DashboardWidget` (Documento 3, apartados 3.2.8 y 3.2.9): `backend/src/entities/index.ts` solo registra `Company, User, Machine, MachineConnection, Signal, RefreshToken, AuthAuditLog`.

Esta es la primera feature vertical del roadmap ([README](../../README.md), "Roadmap", Fase 4) que necesita datos **en tiempo real**, no solo configuración CRUD como las specs 05 y 06. El contrato ya está catalogado — Documento 11 ([11-api-rest.md](../11-api-rest.md), secciones "Signal", "Dashboard / DashboardWidget" y "WebSocket") — y el modelo de dominio ya está cerrado (Documento 3, apartados 3.2.8, 3.2.9, 3.4 "WidgetConfig", 3.5 "WidgetType"); esta spec los implementa, no los rediseña.

**Alcance explícito de esta spec** (principio "evolución controlada", Documento 1):

1. **Signals `FORMULA` quedan sin valor en tiempo real.** El Signal Engine que introduce esta spec únicamente resuelve Signals `DIRECT`. Una Signal `FORMULA` (introducida en spec 06, sin motor de evaluación todavía) nunca tiene entrada en la Realtime Cache; se trata exactamente igual que una Signal `DIRECT` que aún no ha recibido su primer tick — sin ninguna rama de código por `signalType`. Evaluar expresiones `FORMULA` queda para una spec futura del Signal Engine.
2. **El widget `CHART` no consulta histórico.** Solo acumula en el cliente los puntos recibidos por WebSocket desde que se abrió el Dashboard (Documento 8, apartado 8.7, queda diferido). Esta spec no implementa `GET .../signals/:id/history`; esa consulta pertenece a la futura spec de Históricos (Fase 5 del roadmap).
3. **Sin persistencia continua a InfluxDB.** El Signal Engine de esta spec únicamente actualiza la Realtime Cache (en memoria) y publica el evento `SignalUpdated`; no escribe cada lectura en InfluxDB. El backfill puntual `POST .../simulator/seed-history` (spec 04) sigue existiendo sin modificarse, como mecanismo completamente independiente.
4. **El widget `ALARM_LIST` no tiene datos todavía.** No existen las entidades `AlarmDefinition`/`AlarmState` (spec futura de Alarmas, Fase 6). El tipo de widget se admite en el esquema (`WidgetType.ALARM_LIST`) para no romper el modelo de dominio ya cerrado, pero se muestra como un estado vacío fijo tanto en creación (el Frontend permite añadirlo) como en visualización.
5. **Cambio necesario en código de spec 03.** `MachineConnectedPayload`/`MachineDisconnectedPayload` (`use-cases/simulator-control/ports/event-publisher.port.ts`) no incluyen `companyId`, necesario para enrutar el WebSocket por Company. Esta spec añade ese campo a ambos payloads (con el ripple correspondiente en `ForceDisconnectSimulatorUseCase`/`ReconnectSimulatorUseCase`/`SimulatorMachineResolver`), sin cambiar su comportamiento observable.
6. **Corrección de contrato:** el Documento 11 describía la autenticación WebSocket como `?token=` **o** cabecera `Sec-WebSocket-Protocol`; esta última no es implementable de forma limpia con Socket.IO (la librería elegida para el Gateway). El Documento 11 se corrige para reflejar el mecanismo real: `auth` del handshake de Socket.IO, con fallback a `?token=`.

## Actor(es)

`User` con rol `AdminCliente` o `SuperAdmin` (Documento 3, apartado 3.2.2) visualiza Dashboards de su propia Company; un `SuperAdmin` puede además visualizar los de cualquier Company. El propio backend (Signal Engine) actúa como actor de sistema al procesar cada tick del Simulador.

## Precondiciones

- El usuario está autenticado con un `accessToken` válido ([05-auth-login.md](05-auth-login.md)).
- Existen Machines y Signals configuradas ([06-gestion-machines-signals.md](06-gestion-machines-signals.md)) para la Company del usuario.

## Backend

### Flujo principal (Given/When/Then)

- **Given** una Machine con `MachineConnection` de tipo `Simulator` activa y ticking.
- **When** el Simulador genera una nueva lectura para una Signal `DIRECT` de esa Machine.
- **Then** el Signal Engine resuelve la Signal correspondiente por `(machineId, variableName)`, actualiza su entrada en la Realtime Cache (`{ signalId, machineId, companyId, value, quality, timestamp, updatedAt }`) y publica el evento interno `SignalUpdated`.

- **Given** un `AdminCliente` autenticado con Signals de su Company que ya han recibido al menos un tick.
- **When** llama a `GET /api/v1/machines/:machineId/signals/:id/value`.
- **Then** la API responde `200` con `{ "signalId", "value", "quality", "timestamp", "updatedAt" }`, leído directamente de la Realtime Cache (sin consultar el Simulador ni PostgreSQL).

- **Given** un cliente WebSocket que conecta a `wss://.../api/v1/realtime` enviando un `accessToken` válido en el handshake (`auth: { token }`, con fallback a `?token=`).
- **When** la conexión se establece.
- **Then** el servidor verifica el token con el mismo `ITokenService` que usa `JwtAuthGuard` y añade el socket a la sala `company:<companyId>` del usuario; a partir de ese momento recibe únicamente `SignalUpdated`, `MachineConnected` y `MachineDisconnected` de Signals/Machines de su propia Company.

- **Given** un `AdminCliente` autenticado.
- **When** llama a `POST /api/v1/dashboards` con `{ "name": "..." }`.
- **Then** la API responde `201` con el Dashboard creado (`companyId` tomado del token, nunca del payload), sin widgets.

- **Given** un Dashboard existente de la Company del usuario.
- **When** llama a `GET /api/v1/dashboards` o `GET /api/v1/dashboards/:id`.
- **Then** la API responde `200` con la lista paginada de Dashboards de su Company (`GET /dashboards`, misma convención de paginación `?limit=&offset=` del Documento 11) o el detalle de uno con sus widgets, cada widget con las Signals referenciadas ya resueltas (`{ id, name, unit, machineId }`, no solo el id).

- **Given** un Dashboard existente.
- **When** llama a `PATCH /api/v1/dashboards/:id` con `{ "name": "..." }`.
- **Then** la API responde `200` con el Dashboard renombrado.

- **Given** un Dashboard existente.
- **When** llama a `DELETE /api/v1/dashboards/:id`.
- **Then** la API responde `204` y elimina físicamente el Dashboard junto con sus widgets (baja física, a diferencia de Machine/Signal: un Dashboard es pura configuración de presentación sin histórico que preservar, Documento 3 apartado 3.2.8).

- **Given** un Dashboard existente y una o varias Signals activas de la misma Company.
- **When** llama a `POST /api/v1/dashboards/:id/widgets` con `{ "widgetType": "VALUE" | "CHART" | "GAUGE" | "TABLE" | "ALARM_LIST", "signalIds": ["..."], "config": { ... }, "position": 0 }`.
- **Then** la API responde `201` con el widget creado, con su `config` validada según `widgetType` (`GAUGE` requiere `min`/`max`; `CHART` acepta `maxPoints` opcional; `VALUE`/`TABLE`/`ALARM_LIST` no requieren campos obligatorios).

- **Given** un widget existente.
- **When** llama a `PATCH /api/v1/dashboards/:id/widgets/:widgetId` con cualquier combinación de `signalIds`, `config` o `position`.
- **Then** la API responde `200` con el widget actualizado.

- **Given** un widget existente.
- **When** llama a `DELETE /api/v1/dashboards/:id/widgets/:widgetId`.
- **Then** la API responde `204` y elimina físicamente el widget (sin afectar a las Signals referenciadas).

- **Given** una Machine cuya `MachineConnection` se desconecta (forzada por `POST .../simulator/force-disconnect`, spec 03).
- **When** se publica `MachineDisconnected`.
- **Then** todas las Signals con entrada existente en la Realtime Cache para esa Machine pasan a `quality: "OFFLINE"` conservando su último `value`/`timestamp` conocido, y se republica `SignalUpdated` para cada una (Documento 2, apartado 2.6, "Gestión de Máquinas Desconectadas").

### Casos borde / errores (Given/When/Then)

- **Given** una Signal `FORMULA`, o una Signal `DIRECT` que todavía no ha recibido ningún tick.
- **When** se llama a `GET .../signals/:id/value`.
- **Then** la API responde `404` con `code: "SIGNAL_VALUE_NOT_AVAILABLE"` (misma respuesta para ambos casos: la ausencia de entrada en la Realtime Cache es la única señal, sin distinguir por `signalType`).

- **Given** un cliente WebSocket que conecta sin token o con un token inválido/expirado.
- **When** se produce el handshake.
- **Then** el servidor rechaza la conexión inmediatamente (`disconnect`), sin unirla a ninguna sala.

- **Given** un Dashboard o widget perteneciente a otra Company.
- **When** un `AdminCliente` intenta `GET`/`PATCH`/`DELETE` sobre él (por id).
- **Then** la API responde `404` (nunca `403`, mismo criterio OWASP A01 que spec 06).

- **Given** un payload de `POST`/`PATCH` de widget cuyo `signalIds` incluye un id que no existe, no está activo, o pertenece a una Machine de otra Company.
- **When** se procesa la petición.
- **Then** la API responde `422` con `code: "SIGNAL_NOT_FOUND_FOR_WIDGET"`.

- **Given** un payload de widget `widgetType: "GAUGE"` sin `min`/`max`, o con `min >= max`.
- **When** se llama a `POST`/`PATCH` del widget.
- **Then** la API responde `400` (`ValidationPipe` global, `whitelist: true`, `forbidNonWhitelisted: true`, mismo criterio que spec 06).

- **Given** un tick del Simulador para una `variableName` que no corresponde a ninguna Signal `DIRECT` activa de esa Machine, o para una Machine inexistente/inactiva.
- **When** el Signal Engine lo procesa.
- **Then** la actualización se descarta silenciosamente (sin excepción, sin log de error): no se actualiza la Realtime Cache ni se publica `SignalUpdated` (Documento 2, apartado 2.5, "Validación").

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), secciones "Signal" (`GET .../signals/:id/value`), "Dashboard / DashboardWidget" y "WebSocket". Esta spec corrige en ese documento la cláusula de autenticación WebSocket (ver punto 6 de "Contexto"). Esta spec no implementa `GET .../signals/:id/history` (Históricos, spec futura) ni ningún endpoint de `AlarmDefinition`/`AlarmState` (Alarmas, spec futura).

### Criterios de aceptación backend

1. Cada tick del Simulador para una Signal `DIRECT` activa actualiza la Realtime Cache y publica `SignalUpdated`; para `FORMULA`, Machine/Signal inexistente o inactiva, se descarta sin error.
2. `GET .../signals/:id/value` devuelve `200` con el contenido de la Realtime Cache si existe, o `404 SIGNAL_VALUE_NOT_AVAILABLE` si no (FORMULA o sin tick aún), sin distinguir el motivo.
3. El WebSocket rechaza cualquier conexión sin `accessToken` válido en el handshake, y solo entrega eventos de la Company del token conectado.
4. `MachineDisconnected` marca `OFFLINE` en la Realtime Cache a todas las Signals con entrada existente de esa Machine, conservando último valor y timestamp, y republica `SignalUpdated` por cada una.
5. `POST /dashboards` crea el Dashboard con `companyId` del token (nunca del payload); `GET /dashboards` (paginado) y `GET /dashboards/:id` solo devuelven los de la Company del usuario (`SuperAdmin`: de cualquier Company).
6. `DELETE /dashboards/:id` y `DELETE .../widgets/:widgetId` son baja física (no lógica).
7. `POST`/`PATCH` de un widget valida que cada `signalId` en `signalIds` exista, esté activo y pertenezca a la misma Company que el Dashboard; si no, `422 SIGNAL_NOT_FOUND_FOR_WIDGET`.
8. Ningún endpoint de esta spec permite acceder, ni de solo lectura, a un Dashboard/widget/valor de Signal de otra Company (responde `404`).
9. Un payload con campos no declarados en el DTO, o con `config` inválida para su `widgetType` (p. ej. `GAUGE` sin `min`/`max`), es rechazado con `400` antes de llegar a la capa de aplicación.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `AdminCliente` autenticado que navega al Dashboard.
- **When** la página carga.
- **Then** la app abre la conexión WebSocket (token en memoria, mismo origen que usa el interceptor de autenticación) y solicita el Dashboard activo vía REST, renderizando dinámicamente un componente por cada widget según su `widgetType` (Documento 8, apartado 8.3), sin pantallas específicas por máquina.

- **Given** un Dashboard abierto con widgets `VALUE`, `GAUGE` o `TABLE` referenciando Signals `DIRECT` con tick reciente.
- **When** llega un evento `SignalUpdated` por WebSocket para una de esas Signals.
- **Then** únicamente el widget correspondiente actualiza su valor, sin refrescar el resto del Dashboard (Documento 8, apartado 8.4).

- **Given** un widget `CHART` recién abierto.
- **When** el Dashboard se carga y llegan sucesivos `SignalUpdated`.
- **Then** el widget pinta primero el valor actual (una lectura vía REST) y va acumulando cada punto recibido por WebSocket en un buffer en memoria acotado por `config.maxPoints`, sin ninguna llamada a un endpoint de histórico.

- **Given** un widget `ALARM_LIST` en cualquier Dashboard.
- **When** se renderiza.
- **Then** muestra un estado vacío fijo ("Las alarmas estarán disponibles próximamente"), sin llamada REST ni suscripción WebSocket.

- **Given** el detalle de un Dashboard.
- **When** el usuario pulsa "Añadir widget", elige tipo y Signal(es) y confirma.
- **Then** la app llama a `POST .../widgets` y añade el widget a la vista sin recargar la página.

### Casos borde / errores de UI

- **Given** una Signal referenciada por un widget `VALUE`/`GAUGE`/`TABLE` sin valor disponible (`404 SIGNAL_VALUE_NOT_AVAILABLE`).
- **When** se carga el Dashboard.
- **Then** el widget muestra un estado "sin datos disponibles" en vez de un valor, sin bloquear el resto de widgets.

- **Given** una Signal cuya calidad pasa a `OFFLINE` (Machine desconectada).
- **When** llega el `SignalUpdated` correspondiente por WebSocket.
- **Then** el widget sigue mostrando el último valor conocido junto con un indicador visual explícito de pérdida de comunicación (Documento 8, apartado 8.4, Regla 2: nunca de forma silenciosa).

- **Given** la conexión WebSocket se pierde (red, reinicio del backend).
- **When** el cliente detecta la desconexión.
- **Then** intenta reconectar automáticamente; mientras tanto, los widgets conservan su último valor recibido sin indicar erróneamente un cambio de estado de la Signal.

- **Given** un formulario de creación de widget con una Signal inexistente o de otra Machine/Company (caso casi inalcanzable desde la UI, pero posible si la lista quedó desactualizada).
- **When** el backend responde `422 SIGNAL_NOT_FOUND_FOR_WIDGET`.
- **Then** el formulario muestra el error asociado al selector de Signals, sin cerrar el formulario.

### Componentes/pantallas involucrados

Primera implementación real de `frontend/src/app/dashboard/` (hoy placeholder, ver su propio `README.md` con la estructura objetivo) y de `frontend/src/app/core/websocket/` (no existe todavía): servicio de conexión WebSocket reutilizable por toda la app, página de Dashboard con recorrido dinámico de widgets, un componente Angular por `WidgetType` (`VALUE`, `CHART`, `GAUGE`, `TABLE`, `ALARM_LIST`), componente compartido de indicador de calidad (`GOOD`/`BAD`/`UNCERTAIN`/`OFFLINE`) reutilizado por los cuatro widgets con datos reales, y formulario de alta/edición de widget.

### Criterios de aceptación frontend

1. El Dashboard se construye dinámicamente recorriendo sus widgets configurados, sin código específico por máquina o Company.
2. Un `SignalUpdated` recibido por WebSocket actualiza únicamente el widget correspondiente.
3. El widget `CHART` nunca realiza una petición de histórico; solo muestra puntos acumulados desde la apertura del Dashboard.
4. El widget `ALARM_LIST` muestra siempre su estado vacío fijo, sin intentar cargar datos.
5. Una Signal sin valor disponible o con calidad `OFFLINE` se comunica siempre explícitamente en su widget, nunca de forma silenciosa ni con un fallo genérico que oculte el resto del Dashboard.
6. Crear un widget actualiza la vista del Dashboard sin recargar la página.
