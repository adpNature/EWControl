# Spec: Históricos

## Contexto

La spec 07 ([07-dashboard-tiempo-real.md](07-dashboard-tiempo-real.md)) dejó diferidos explícitamente dos puntos hacia esta spec, en su propia sección "Contexto":

1. _"El widget `CHART` no consulta histórico. Solo acumula en el cliente los puntos recibidos por WebSocket desde que se abrió el Dashboard (...). Esta spec no implementa `GET .../signals/:id/history`; esa consulta pertenece a la futura spec de Históricos (Fase 5 del roadmap)."_
2. _"Sin persistencia continua a InfluxDB. El Signal Engine de esta spec únicamente actualiza la Realtime Cache (en memoria) y publica el evento `SignalUpdated`; no escribe cada lectura en InfluxDB."_

El diseño arquitectónico de Históricos ya está cerrado en los documentos base — esta spec lo implementa, no lo rediseña, mismo principio de "evolución controlada" (Documento 1) que ya aplicó la spec 07 sobre Dashboard:

- El orden de fases ([01-vision.md](../01-vision.md), "Alcance inicial"): _"4. Dashboard. 5. Históricos. 6. Alarmas."_
- El contrato del endpoint ya está catalogado ([11-api-rest.md](../11-api-rest.md), sección "Signal"): `GET .../signals/:id/history`, query `from`, `to` (ISO 8601), `resolution` opcional (`raw`, `minute`, `hour`, `day`, `month`).
- El modelo de persistencia y agregación ya está descrito ([04-persistencia-de-datos.md](../04-persistencia-de-datos.md), apartados 4.3 "Agregaciones", 4.7 "Adquisición de Datos y Persistencia" y 4.8 "Flujo Global de Persistencia": _"Data Provider → Signal Engine → Realtime Cache → (si history_enabled) → InfluxDB"_).
- El comportamiento del Frontend ya está descrito ([08-frontend-dashboard.md](../08-frontend-dashboard.md), apartado 8.7 "Históricos y Gráficos").

La infraestructura de InfluxDB ya existe, cableada por la spec 04 ([04-simulador-seed-historico.md](04-simulador-seed-historico.md)) para el backfill puntual de la Machine demo: el puerto `IHistoryWriter` (`backend/src/use-cases/history/ports/history-writer.port.ts`) y su adaptador `InfluxDbHistoryRepository` (`backend/src/interface-adapters/persistence/influxdb/influxdb-history.repository.ts`), ya usados por `SeedHistoryUseCase`. También existe ya, desde la spec 06, el flag `Signal.historyEnabled` (`backend/src/entities/signal.entity.ts`), sin ningún efecto todavía sobre el flujo en vivo. Esta spec añade lo único que falta: el **camino de escritura continua** (cada tick, no solo el seed puntual) y el **camino de lectura** (consulta por rango con agregación), y conecta ambos con el widget `CHART` del Dashboard.

**Alcance explícito de esta spec** (principio "evolución controlada", Documento 1):

1. Se cierra exactamente lo diferido por spec 07: persistencia continua a InfluxDB + endpoint de consulta + el widget `CHART` real. No se crea una pantalla "Históricos" independiente (`frontend/src/app/history/`, hoy solo un `README.md` placeholder) ni ninguna comparativa multi-Signal o multi-Machine: eso queda para una spec futura de esa feature.
2. Evaluar Signals `FORMULA` sigue fuera de alcance (Signal Engine futuro, ya diferido por spec 07); una Signal `FORMULA` nunca genera puntos de histórico porque nunca recibe ticks del Signal Engine.
3. Alarmas (`AlarmDefinition`/`AlarmState`, Fase 6) siguen sin implementarse.

## Actor(es)

`User` con rol `AdminCliente` o `SuperAdmin` consulta el histórico de Signals de su propia Company (un `SuperAdmin`, de cualquier Company) mediante el widget `CHART` de un Dashboard. El propio backend (Signal Engine) actúa como actor de sistema al persistir cada tick con histórico habilitado.

## Precondiciones

- El usuario está autenticado con un `accessToken` válido ([05-auth-login.md](05-auth-login.md)).
- Existen Machines y Signals configuradas ([06-gestion-machines-signals.md](06-gestion-machines-signals.md)), con al menos una Signal `DIRECT` con `historyEnabled: true`.
- El Dashboard con un widget `CHART` ya existe ([07-dashboard-tiempo-real.md](07-dashboard-tiempo-real.md)).

## Backend

### Flujo principal (Given/When/Then)

- **Given** una Signal `DIRECT` activa con `historyEnabled: true`.
- **When** el Signal Engine (`IngestSignalTickUseCase`) procesa un nuevo tick para esa Signal.
- **Then** además del comportamiento ya existente de la spec 07 (actualizar la Realtime Cache y publicar `SignalUpdated`, sin cambios), escribe el punto `{ companyId, machineId, signalId, value, timestamp }` en InfluxDB vía `IHistoryWriter.writeBatch` (Documento 4, apartado 4.7).

- **Given** una Signal `DIRECT` activa con `historyEnabled: false`.
- **When** el Signal Engine procesa un tick.
- **Then** no se escribe ningún punto en InfluxDB (comportamiento actual sin cambios); la Realtime Cache y `SignalUpdated` se comportan igual que hoy.

- **Given** InfluxDB no disponible en el momento de procesar un tick de una Signal con histórico habilitado.
- **When** el Signal Engine intenta persistir el punto.
- **Then** la Realtime Cache se actualiza y `SignalUpdated` se publica con normalidad; el fallo de escritura a InfluxDB se descarta silenciosamente, sin propagar la excepción (Documento 4, apartado 4.8, "Tolerancia a Fallos": _"Un fallo de InfluxDB no interrumpe el tiempo real"_).

- **Given** un `AdminCliente` autenticado con una Signal de su Company.
- **When** llama a `GET /api/v1/machines/:machineId/signals/:id/history?from=<ISO8601>&to=<ISO8601>` (sin `resolution`).
- **Then** la API responde `200` con `{ "signalId", "resolution", "points": [{ "timestamp", "value" }] }`, infiriendo la resolución a partir del span `to - from` (Documento 4, apartado 4.3; Documento 8, apartado 8.7: _"delega en el Backend la selección de resolución adecuada"_): `≤ 6 horas → raw`, `≤ 2 días → minute`, `≤ 30 días → hour`, `≤ 180 días → day`, `> 180 días → month`.

- **Given** un `AdminCliente` autenticado con una Signal de su Company.
- **When** llama a `GET .../history` indicando explícitamente `resolution=raw|minute|hour|day|month`.
- **Then** la API respeta la resolución solicitada tal cual, sin inferirla (uso avanzado del contrato, p. ej. otros consumidores de la API; el Frontend de esta spec nunca envía este parámetro).

- **Given** cualquiera de los dos casos anteriores.
- **Then** los puntos devueltos no llevan agregación para `resolution=raw`, y llevan media (`mean`) agregada por ventana (minuto/hora/día/mes) para el resto (Documento 4, apartado 4.3, "Agregaciones").

- **Given** una Signal `FORMULA`, una Signal sin histórico habilitado nunca, o un rango temporal sin lecturas almacenadas.
- **When** se consulta su histórico.
- **Then** la API responde `200` con `points: []` — la ausencia de datos es un estado válido, no un error, y no se distingue el motivo (mismo principio que spec 07 aplicó al no diferenciar por `signalType`).

### Casos borde / errores (Given/When/Then)

- **Given** una petición a `GET .../history` con `from`/`to` ausentes, no ISO 8601, o (si se indica explícitamente) `resolution` fuera de `raw`, `minute`, `hour`, `day`, `month`.
- **When** se procesa la petición.
- **Then** la API responde `400` (`ValidationPipe` global, `whitelist: true`, `forbidNonWhitelisted: true`, mismo criterio que specs anteriores).

- **Given** una petición a `GET .../history` con `from >= to`.
- **When** se procesa la petición.
- **Then** la API responde `400` con `code: "INVALID_RANGE"`.

- **Given** una Signal perteneciente a otra Company, inexistente o inactiva.
- **When** un `AdminCliente` llama a `GET .../history` sobre ella (por id).
- **Then** la API responde `404` con `code: "SIGNAL_NOT_FOUND"` (nunca `403`, mismo criterio OWASP A01 que specs anteriores).

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección "Signal", endpoint `GET .../signals/:id/history` (ya catalogado desde la spec 07; esta spec añade el shape de la respuesta: `{ "signalId": string, "resolution": string, "points": [{ "timestamp": string, "value": number }] }`).

### Criterios de aceptación backend

1. Un tick de una Signal `DIRECT` activa con `historyEnabled: true` persiste en InfluxDB un punto con `companyId`, `machineId`, `signalId`, `value` y `timestamp` correctos; con `historyEnabled: false`, no persiste nada.
2. Un fallo de InfluxDB al escribir un punto no impide que la Realtime Cache se actualice ni que se publique `SignalUpdated`.
3. `GET .../history` sin `resolution` infiere la resolución a partir del span `to - from` según los umbrales documentados (`≤6h→raw`, `≤2d→minute`, `≤30d→hour`, `≤180d→day`, `>180d→month`); con `resolution` explícita, la respeta tal cual.
4. Con `resolution=raw` (inferida o explícita) devuelve los puntos crudos del rango solicitado; con `minute`, `hour`, `day` o `month` devuelve la media agregada por esa ventana, sin huecos dentro del rango con datos.
5. `GET .../history` sobre una Signal sin datos en el rango (por no tener histórico habilitado, ser `FORMULA`, o no tener lecturas en ese rango) responde `200` con `points: []`, nunca un error.
6. `GET .../history` sobre una Signal de otra Company responde `404` (nunca `403` ni datos de esa Signal).
7. Una petición con `from`/`to` no ISO 8601, `resolution` explícita no soportada, o `from >= to`, es rechazada con `400` antes de llegar a la capa de aplicación.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un widget `CHART` recién abierto en un Dashboard, referenciando una Signal con histórico disponible.
- **When** el widget se inicializa.
- **Then** solicita un rango histórico por defecto (última hora) vía REST indicando solo `from`/`to` (nunca `resolution` — Documento 8, apartado 8.7: el Frontend delega siempre en el Backend la elección de resolución), pinta esos puntos como serie inicial, y a partir de ahí sigue acumulando los `SignalUpdated` recibidos por WebSocket sobre esa misma serie, sin romper el comportamiento en vivo ya existente de la spec 07.

- **Given** un widget `CHART` con datos ya cargados.
- **When** el usuario cambia el selector de rango temporal del propio widget (p. ej. última hora / último día / última semana / último mes).
- **Then** el widget dispara una nueva petición REST con el rango elegido y sustituye su serie de puntos, sin recargar el Dashboard ni afectar a los demás widgets (Documento 8, apartado 8.7, Regla 2: _"Un cambio de rango temporal en un widget nunca afecta a los demás widgets del mismo Dashboard"_).

### Casos borde / errores de UI

- **Given** un widget `CHART` cuya Signal no tiene datos históricos en el rango seleccionado.
- **When** se carga o cambia el rango.
- **Then** el widget muestra un estado "sin datos en este rango" en vez de un gráfico vacío ambiguo, sin bloquear el resto del Dashboard.

- **Given** un fallo de red o del backend al solicitar histórico.
- **When** se produce el fallo.
- **Then** el widget continúa funcionando en modo "solo tiempo real" sobre los puntos ya cargados (o vacío si aún no cargó ninguno), sin bloquear el resto del Dashboard (mismo criterio de degradación que spec 07 aplicó a `SIGNAL_VALUE_NOT_AVAILABLE`).

### Componentes/pantallas involucrados

Extensión de `frontend/src/app/dashboard/widgets/chart/` (`ChartWidgetComponent`, ya existente desde spec 07): carga inicial de histórico y selector de rango. Extensión de `SignalsApiService` (`frontend/src/app/config/adapters/signals-api.service.ts`) con el nuevo método de consulta de histórico. No se modifica `frontend/src/app/history/` (placeholder sin implementar, fuera de alcance) ni el modelo `WidgetConfig`/`Dashboard` del backend: el rango seleccionado es estado de UI del propio widget, no se persiste.

### Criterios de aceptación frontend

1. Al abrir un Dashboard, un widget `CHART` sobre una Signal con histórico habilitado muestra datos históricos reales, no solo puntos acumulados desde la apertura.
2. Cambiar el rango temporal de un widget `CHART` no recarga el Dashboard ni afecta a los demás widgets.
3. Una Signal sin histórico disponible en el rango seleccionado se comunica siempre explícitamente en su widget.
4. Los eventos `SignalUpdated` recibidos por WebSocket se siguen aplicando en tiempo real sobre la serie cargada desde histórico, sin duplicar ni perder puntos.
