# Spec: Históricos — pantalla independiente y comparativas multi-Signal/Machine

## Contexto

La spec 08 ([08-historicos.md](08-historicos.md)) cerró la persistencia continua a InfluxDB, el
endpoint de consulta por rango de una sola Signal y el widget `CHART` real del Dashboard, pero
dejó diferido explícitamente el resto de "Históricos" como funcionalidad propia: _"No se crea una
pantalla 'Históricos' independiente (`frontend/src/app/history/`, hoy solo un `README.md`
placeholder) ni ninguna comparativa multi-Signal o multi-Machine: eso queda para una spec futura
de esa feature"_ (`docs/specs/08-historicos.md:21`). La spec 09 lo recordó de nuevo al cerrar
Alarmas: _"No se crea ninguna pantalla de comparativas ni el histórico independiente de Signals
(spec 14, feature distinta)"_ (`docs/specs/09-alarmas.md:25`). El [README](../../README.md) raíz
fija esta feature como **Fase 10** del roadmap ("Feature vertical: Históricos — pantalla
independiente y comparativas", `README.md:216`), y `docs/specs/README.md` ("Pendientes") ya la
numeraba como spec 14, tentativa correlativa tras la 13 (motor de fórmulas).

El diseño arquitectónico de la consulta comparativa ya está anticipado en los documentos base —
esta spec lo implementa, no lo rediseña, mismo principio de "evolución controlada" que ya
aplicaron las specs 07, 08 y 13:

- `docs/04-persistencia-de-datos.md` §4.3, tabla "Patrones de Consulta", ya lista _"Comparativa a
  nivel Company | company_id + rango temporal"_ como patrón de consulta sobre InfluxDB, junto a
  los ya implementados "Histórico de una Signal" y "Histórico de una Machine".
- `docs/08-frontend-dashboard.md` §8.7 ("Históricos y Gráficos") ya fija las reglas que esta spec
  hereda sin cambiarlas: el Frontend nunca calcula agregaciones (Regla 1) ni elige la resolución
  (delega siempre en el Backend); y §8.8 ("Multiempresa en el Frontend") fija la Regla 1 que esta
  spec debe respetar en una pantalla nueva que, por primera vez, permite combinar datos de varias
  Machines a la vez: _"Ninguna pantalla del Frontend combina información de más de una Company
  simultáneamente"_ (`docs/08-frontend-dashboard.md:336`).

**Reutilización explícita de lo ya implementado por la spec 08** (sin tocarlo):
`GetSignalHistoryUseCase`, `IHistoryReader.queryRange`, `InfluxDbHistoryRepository`,
`resolveHistoryResolution` (umbrales `≤6h→raw, ≤2d→minute, ≤30d→hour, ≤180d→day, >180d→month`,
`backend/src/use-cases/history/resolve-history-resolution.ts:15-30`) y el endpoint singular
`GET /machines/:machineId/signals/:id/history` siguen existiendo sin ningún cambio de
comportamiento observable; esta spec añade un camino nuevo en paralelo, no lo sustituye.

**Decisión de diseño 1 — consulta batch en el Backend, no N llamadas desde el Frontend.** La
comparativa se resuelve con un único endpoint nuevo que acepta varias Signals a la vez y devuelve
todas sus series en una sola respuesta, en vez de que el Frontend dispare una llamada paralela por
Signal al endpoint singular ya existente. Motivo: aunque el endpoint singular ya cubre por
completo el aislamiento de Company y la lógica de resolución, resolver la validación de N Signals
en una sola pasada en el servidor evita N round-trips y deja la regla "todas las Signals
comparadas deben pertenecer a la misma Company" garantizada en un único punto, no repartida en el
cliente.

**Decisión de diseño 2 — reutilización del patrón de validación multi-signal ya escrito para
Dashboard widgets.** `validateWidgetSignalIds`
(`backend/src/use-cases/dashboard/validate-widget-signal-ids.ts:10-31`) ya resuelve exactamente el
mismo problema (una lista de `signalId` debe existir, estar activa y pertenecer a una `companyId`
dada) para la creación/edición de un `DashboardWidget`. Esta spec extrae su bucle de clasificación
a un helper compartido (`use-cases/shared/classify-signal-ids-by-company.ts`), reutilizado por
ambos casos de uso, sin modificar el contrato ya publicado y documentado de
`422 SIGNAL_NOT_FOUND_FOR_WIDGET` (spec 07, `docs/11-api-rest.md`). Se crea la carpeta
`use-cases/shared/` en este momento porque ya tiene dos consumidores reales, no por anticipación.

**Decisión de diseño 3 — scoping de Company para SuperAdmin, obligatorio (no opcional).**
`ListUsersQueryDto.companyId?` (`backend/src/interface-adapters/rest/user-management/list-users-query.dto.ts`)
ya establece el patrón: un parámetro opcional que solo tiene efecto cuando el requester es
`SuperAdmin` (un `AdminCliente` lo ignora siempre, usa su propia `companyId`). Esta spec reutiliza
el mismo patrón con una diferencia deliberada: en un listado (Users, Machines) "sin Company
elegida" puede significar válidamente "todas mezcladas, cada fila con la suya"; en una
comparativa que superpone series en un mismo gráfico, "todas mezcladas" violaría directamente
`docs/08-frontend-dashboard.md:336`. Por tanto, para un `SuperAdmin`, `companyId` es obligatorio
en este endpoint concreto.

**Gap detectado y cerrado en esta misma spec.** `ListMachinesUseCase`
(`backend/src/use-cases/machine-management/list-machines.use-case.ts:34-35`) hoy fija
`companyId: null` para cualquier `SuperAdmin`, es decir, `GET /machines` le devuelve las Machines
de **todas** las Companies mezcladas, sin forma de acotar a una sola — a diferencia de
`GET /users`, que ya soporta `?companyId=`. El nuevo selector cross-Machine de esta spec (ver
"Frontend") necesita que un `SuperAdmin` pueda listar solo las Machines de la Company que está
operando; se añade `ListMachinesQueryDto.companyId?` replicando exactamente
`ListUsersQueryDto`/`ListUsersUseCase`, sin cambiar el comportamiento por defecto (sin el
parámetro, un `SuperAdmin` sigue viendo todas, igual que hoy).

**Alcance explícito de esta spec** (principio "evolución controlada", Documento 1):

1. Se implementa el ciclo completo: nuevo endpoint batch de histórico multi-Signal, nueva pantalla
   `frontend/src/app/history/` con selector de Signals cross-Machine (hasta 8 a la vez) y gráfico
   comparativo multi-serie, nuevo ítem "Históricos" en la sidebar, y el fix de `GET /machines`
   con `?companyId=` para `SuperAdmin`.
2. Queda fuera: cualquier cambio al widget `CHART` del Dashboard (sigue siendo de una sola Signal,
   con acumulación en vivo por WebSocket) y al endpoint singular `GET .../signals/:id/history`;
   ambos siguen existiendo sin modificación, en paralelo al camino nuevo.
3. Queda fuera: comparar Signals de **distintas Companies** en un mismo gráfico — prohibido por
   `docs/08-frontend-dashboard.md:336`; ver "Casos borde" para el rechazo exacto.
4. Queda fuera: exportar el resultado de una comparativa (CSV/imagen) y guardar comparativas
   favoritas — ninguno de los dos está descrito en los documentos base; evolución futura.
5. Queda fuera: un eje Y compartido cuando las Signals comparadas tienen unidades distintas (p.
   ej. °C vs bar); cada serie se normaliza a su propio rango de valores (ver "Frontend",
   Componentes/pantallas involucrados) — comparación de forma/tendencia relativa, no de magnitud
   absoluta. Un modo de eje compartido cuando todas las Signals comparten `unit` es una posible
   evolución futura, no de esta spec.

## Actor(es)

`User` con rol `AdminCliente` o `SuperAdmin` (Documento 3, apartado 3.2.2) consulta y compara el
histórico de varias Signals de su propia Company, aunque pertenezcan a distintas Machines; un
`SuperAdmin` puede hacerlo sobre cualquier Company, eligiendo explícitamente sobre cuál opera.

## Precondiciones

- El usuario está autenticado con un `accessToken` válido ([05-auth-login.md](05-auth-login.md)).
- Existen Machines y Signals configuradas ([06-gestion-machines-signals.md](06-gestion-machines-signals.md))
  con histórico ya persistido en InfluxDB para al menos algunas de ellas (spec 08).
- Un `SuperAdmin` ha seleccionado la Company sobre la que quiere operar
  (`docs/08-frontend-dashboard.md` §8.8, mismo mecanismo ya usado por otras pantallas de
  Configuración).

## Backend

### Flujo principal (Given/When/Then)

- **Given** un `AdminCliente` autenticado con entre 1 y 8 Signals activas de su Company, de
  cualquiera de sus Machines.
- **When** llama a `GET /api/v1/signals/history?signalIds=<id1>,<id2>,...&from=<ISO8601>&to=<ISO8601>`
  (sin `resolution`).
- **Then** la API responde `200` con
  `{ "resolution": "...", "series": [{ "signalId", "machineId", "points": [{ "timestamp", "value" }] }] }`,
  una entrada de `series` por cada `signalId` único solicitado, en el mismo orden en que se
  solicitaron, con la resolución inferida del span `to - from` con los mismos umbrales ya
  fijados por la spec 08 (`resolveHistoryResolution`, reutilizada sin cambios).

- **Given** la misma petición, indicando explícitamente `resolution=raw|minute|hour|day|month`.
- **When** se procesa.
- **Then** la API respeta la resolución solicitada tal cual para todas las series por igual,
  sin inferirla (mismo criterio ya establecido por spec 08 para el endpoint singular).

- **Given** un `SuperAdmin` autenticado que indica explícitamente `companyId=<id de una Company>`.
- **When** llama al mismo endpoint con `signalIds` que pertenecen todas a esa Company.
- **Then** la API responde `200` igual que para un `AdminCliente`, acotando la validación de
  cada Signal a esa `companyId` (nunca a la del propio `SuperAdmin`, que no tiene una Company
  propia).

- **Given** cualquiera de los casos anteriores, con una o varias de las Signals solicitadas de
  tipo `FORMULA`, con `historyEnabled: false`, o sin lecturas almacenadas en el rango pedido.
- **When** se procesa la petición.
- **Then** la entrada de `series` correspondiente a esa Signal tiene `points: []` — la ausencia
  de datos es un estado válido, no un error, igual que ya establece spec 08 para el endpoint
  singular (`docs/specs/08-historicos.md:62-64`), aplicado ahora por Signal dentro de la
  respuesta batch en lugar de a la respuesta completa.

- **Given** una petición cuyo `signalIds` contiene el mismo id repetido más de una vez.
- **When** se procesa.
- **Then** la API lo deduplica silenciosamente (se conserva el orden de la primera aparición) y
  devuelve una única entrada de `series` para ese id — nunca un error ni una entrada duplicada.

**Nota de seguridad (OWASP A03, Injection):** la consulta Flux batch a InfluxDB filtra por el
conjunto de `signalIds` de la petición; ese conjunto solo llega a construirse con los ids que ya
pasaron la clasificación de existencia/pertenencia a Company (`classifySignalIdsByCompany`) —
nunca con el `signalIds` crudo de la query string. Mismo criterio de confianza que ya aplican
`queryRange`/`deleteByPredicate` en `InfluxDbHistoryRepository`: ningún valor no verificado llega
a formar parte de la query.

### Casos borde / errores (Given/When/Then)

- **Given** una petición con más de 8 `signalIds` distintos, o con `signalIds` vacío, o con algún
  elemento que no sea un UUID válido.
- **When** se procesa.
- **Then** la API responde `400` (`ValidationPipe` global, `whitelist: true,
forbidNonWhitelisted: true`, mismo criterio que specs anteriores), antes de llegar a la capa de
  aplicación.

- **Given** una petición con `from`/`to` ausentes, no ISO 8601, `from >= to`, o (si se indica
  explícitamente) `resolution` fuera de `raw|minute|hour|day|month`.
- **When** se procesa.
- **Then** la API responde `400` por `ValidationPipe`, salvo `from >= to`, que responde `400` con
  `code: "INVALID_RANGE"` (reutiliza `InvalidHistoryRangeError`, igual que spec 08).

- **Given** un `AdminCliente` cuyo `signalIds` incluye una Signal inexistente, inactiva, o
  perteneciente a otra Company.
- **When** se procesa la petición.
- **Then** la API responde `422` con `code: "SIGNAL_NOT_FOUND_FOR_HISTORY"` y
  `details: { "signalIds": [...] }` listando **todos** los ids problemáticos de la petición, sin
  distinguir el motivo de cada uno (nunca `403`, nunca `404`; mismo criterio OWASP A01 ya aplicado
  por `422 SIGNAL_NOT_FOUND_FOR_WIDGET` en spec 07 — aquí `signalIds` llega por query, no por
  body, pero es el mismo tipo de validación de una lista de referencias, no de un recurso
  identificado por su propio `:id` en la URL, por eso el código es `422` y no `404`).

- **Given** un `SuperAdmin` autenticado que no indica `companyId`.
- **When** llama al endpoint.
- **Then** la API responde `400` con `code: "COMPANY_ID_REQUIRED"` — un `SuperAdmin` nunca puede
  ejecutar esta comparativa sin haber resuelto antes una única Company (`docs/08-frontend-dashboard.md:336`).

- **Given** un `SuperAdmin` con `companyId` explícito, cuyo `signalIds` incluye alguna Signal que
  pertenece a una Company distinta de la indicada.
- **When** se procesa la petición.
- **Then** esa Signal se reporta como inválida en el mismo `422 SIGNAL_NOT_FOUND_FOR_HISTORY` que
  el resto de casos de no-pertenencia, sin confirmar que existe en otra Company real (mismo
  criterio OWASP A01 de nunca distinguir el motivo del rechazo).

- **Given** un `AdminCliente` que además indica `companyId` en la query (la suya o de otra
  Company).
- **When** se procesa la petición.
- **Then** el parámetro se ignora siempre; la validación se acota a `requester.companyId`, igual
  que ya hace `ListUsersUseCase` con `AdminCliente`.

- **Given** InfluxDB no disponible en el momento de resolver la consulta batch.
- **When** el Backend intenta leer las series.
- **Then** la petición falla con `500` — no existe hoy ninguna degradación en el camino de
  lectura (solo en el de escritura, spec 08, "Tolerancia a Fallos"); esta spec no introduce
  ninguna nueva, mismo comportamiento que ya tiene el endpoint singular ante el mismo fallo.

### Contrato de entrada/salida

Nuevo endpoint, catalogado en [11-api-rest.md](../11-api-rest.md) sección "Signal" junto al ya
existente `GET .../signals/:id/history` (spec 08) y a `GET .../signals/:signalId/alarm-definitions`
(spec 09), que ya establece el precedente de rutas top-level `/api/v1/signals/...` no anidadas
bajo una Machine concreta — necesario aquí porque la comparativa por definición abarca varias:

```
GET /api/v1/signals/history
  ?signalIds=<uuid,uuid,...>   (1 a 8 elementos, cada uno UUID)
  &from=<ISO8601>
  &to=<ISO8601>
  &resolution=<raw|minute|hour|day|month>   (opcional)
  &companyId=<uuid>                          (opcional; obligatorio en la práctica para SuperAdmin)
```

Respuesta `200`:

```json
{
  "resolution": "hour",
  "series": [
    {
      "signalId": "uuid-1",
      "machineId": "uuid-m1",
      "points": [{ "timestamp": "2026-07-17T10:00:00Z", "value": 72.5 }]
    },
    { "signalId": "uuid-2", "machineId": "uuid-m2", "points": [] }
  ]
}
```

Deliberadamente no incluye nombre/unidad de Signal o Machine (mismo minimalismo que
`GetSignalHistoryResult`, que solo devuelve `signalId`): el Frontend ya dispone de esos datos por
las llamadas a `GET /machines` y `GET /machines/:machineId/signals` que usa para construir el
selector, y los cruza por `signalId`/`machineId` en el cliente sin que el Backend los reenvíe.

`signalIds` se envía coma-separado (`?signalIds=a,b,c`), no como parámetros repetidos: no hay
ningún precedente de query multivalor en este Backend (`PaginationQueryDto`/`ListUsersQueryDto`
son escalares; los `@IsArray` existentes, como `CreateWidgetDto.signalIds`, son siempre de body
JSON) y `ApiService.get()` del Frontend (`frontend/src/app/core/http/api.service.ts`) no soporta
arrays de parámetros hoy — coma-separado evita tocar ese wrapper compartido.

### Criterios de aceptación backend

1. Un `AdminCliente` con 1 a 8 Signals válidas de su Company, de distintas Machines, obtiene una
   entrada de `series` por cada `signalId` único solicitado, en el orden pedido, con `points`
   correctos por rango.
2. Sin `resolution`, se infiere del span `to - from` con los mismos umbrales que el endpoint
   singular de spec 08; con `resolution` explícita, se respeta tal cual para todas las series.
3. Cualquier `signalId` inexistente, inactivo o de otra Company (respecto a la Company efectiva
   del requester) responde `422 SIGNAL_NOT_FOUND_FOR_HISTORY` con la lista completa de ids
   problemáticos, sin distinguir el motivo.
4. Un `SuperAdmin` sin `companyId` responde `400 COMPANY_ID_REQUIRED`; con `companyId`, la
   validación de cada Signal queda acotada exactamente a esa Company, nunca a la suya propia (no
   tiene) ni a ninguna otra.
5. Un `AdminCliente` que envía `companyId` lo tiene siempre ignorado; se acota a su propia
   Company.
6. Más de 8 `signalIds`, `signalIds` vacío, o algún elemento no-UUID, responde `400` antes de
   llegar a la capa de aplicación.
7. `signalIds` repetidos se deduplican silenciosamente; la respuesta nunca contiene dos entradas
   de `series` para el mismo `signalId`.
8. Una Signal `FORMULA`, sin histórico habilitado, o sin lecturas en el rango, aparece en su
   propia entrada de `series` con `points: []`, nunca como error ni como ausencia de la entrada.
9. `GET /machines` con `?companyId=<uuid>` y requester `SuperAdmin` devuelve solo las Machines de
   esa Company; sin el parámetro, sigue devolviendo las de todas (comportamiento actual, sin
   cambios); un `AdminCliente` lo ignora siempre.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `AdminCliente` autenticado que pulsa "Históricos" en la sidebar.
- **When** la pantalla carga.
- **Then** ve un selector de Signals agrupado por Machine (todas las Machines/Signals de su
  Company, sin selector de Company visible) y un `RangeSelectorComponent` ya existente
  (`frontend/src/app/shared/ui/range-selector/`), reutilizado tal cual.

- **Given** la pantalla de Históricos con hasta 8 Signals marcadas (de una o varias Machines) y
  un rango elegido.
- **When** el usuario confirma la comparativa.
- **Then** la app llama una sola vez a `GET /signals/history` con esas Signals y ese rango, y
  pinta un único gráfico con una serie por Signal, cada una con su propio color y una leyenda
  (Machine — Signal — unidad — último valor).

- **Given** una comparativa ya cargada.
- **When** el usuario cambia el rango temporal.
- **Then** se repite la petición batch con la selección de Signals actual completa, sustituyendo
  todas las series a la vez (no hay acumulación en vivo por WebSocket en esta pantalla, a
  diferencia del widget `CHART`).

- **Given** un `SuperAdmin` autenticado que pulsa "Históricos".
- **When** la pantalla carga.
- **Then** ve primero un selector obligatorio de Company (reutilizando `SelectedCompanyState`,
  `frontend/src/app/config/use-cases/selected-company.state.ts`, y `CompaniesState`; sin opción
  "todas las Companies", a diferencia del listado de Users) antes de poder ver ningún selector de
  Signals ni gráfico.

### Casos borde / errores de UI

- **Given** 8 Signals ya marcadas en el selector.
- **When** el usuario intenta marcar una novena.
- **Then** el resto de checkboxes no marcados se deshabilitan con un mensaje ("Máximo 8 Signals
  por comparativa"), evitando una petición que el Backend rechazaría con `400`.

- **Given** un `SuperAdmin` con Signals ya seleccionadas y/o una comparativa ya cargada para la
  Company A.
- **When** cambia la Company seleccionada a B.
- **Then** la selección de Signals y cualquier serie ya cargada se limpian inmediatamente (mismo
  criterio que `dashboard-page.ts` aplica hoy a `signalIds` al cambiar de Machine), evitando un
  `422` garantizado por mezclar Companies.

- **Given** una comparativa cargada donde una o varias Signals no tienen datos en el rango
  elegido.
- **When** se pinta el gráfico.
- **Then** la leyenda de esa Signal muestra explícitamente "sin datos en este rango", sin romper
  el resto de series ni mostrar un gráfico vacío ambiguo (mismo criterio ya aplicado por spec 08
  al widget `CHART`).

- **Given** un fallo de red o del Backend al solicitar la comparativa.
- **When** se produce el fallo.
- **Then** la pantalla muestra un estado de error explícito con acción de reintentar — a
  diferencia del widget `CHART` (que degrada a "solo tiempo real" gracias al WebSocket), esta
  pantalla no tiene ningún dato en vivo sobre el que degradar, así que el criterio de
  recuperación es distinto y debe comunicarse como tal, nunca de forma silenciosa.

### Componentes/pantallas involucrados

Primera implementación real de `frontend/src/app/history/` (hoy solo `README.md` placeholder),
con la misma estructura `entities/`, `use-cases/`, `adapters/`, `pages/` que features hermanas
como `frontend/src/app/alarms/`:

- `adapters/history-api.service.ts`: llama al nuevo `GET /signals/history`.
- `use-cases/history-comparison.state.ts`: selección de Signals, rango y series cargadas.
- `use-cases/history-breadcrumbs.ts` + `history.routes.ts`: mismo patrón de rutas lazy
  (`loadChildren`) y breadcrumb que `frontend/src/app/alarms/alarms.routes.ts`; nuevo hijo
  `history` en `frontend/src/app/app.routes.ts`, junto a `dashboard`/`config`/`alarms`.
- `pages/history-page/`: página principal, con dos subcomponentes co-localizados (un único
  consumidor cada uno, no en `shared/ui/`):
  - `signal-picker/`: selector cross-Machine que compone `GET /machines` (con `?companyId=` para
    `SuperAdmin`, tras el fix de esta misma spec) + `GET /machines/:machineId/signals` por cada
    Machine devuelta — mismas llamadas ya existentes, generalizando el patrón de un-solo-Machine
    que hoy usa `dashboard-page.ts` (`onMachineChange`) a todas las Machines de la Company.
  - `multi-series-chart/`: SVG propio sin librería externa (coherente con el enfoque ya elegido
    por `ChartWidgetComponent`, que tampoco usa ninguna), con una serie por Signal normalizada a
    su propio rango de valores (ver "Alcance explícito", punto 5) y una leyenda con color,
    Machine, Signal, unidad y último valor por serie. No extiende `ChartWidgetComponent`: ese
    componente está atado a una sola Signal y a la acumulación en vivo por WebSocket, ninguna de
    las cuales aplica aquí; solo se reutiliza la idea de normalizar puntos a un `viewBox` SVG
    (duplicada, no extraída, por tratarse de un cálculo pequeño con un segundo consumidor de
    contrato distinto).
- Nuevo ítem "Históricos" en `frontend/src/app/core/layout/sidebar/sidebar.component.html`,
  mismo patrón `routerLink`/`routerLinkActive`/`app-icon` que los ítems existentes; requiere
  añadir un nuevo icono (Iconsax "Essential", conjunto gratuito) a `frontend/public/icons/`, hoy
  sin ninguno de tipo gráfico/histórico.
- `ListMachinesQueryDto`/`ListMachinesUseCase` (Backend, ver arriba): fix necesario para que el
  selector de un `SuperAdmin` no tenga que descargar y filtrar en el cliente las Machines de
  todas las Companies.

No se modifica `frontend/src/app/dashboard/widgets/chart/` ni el modelo `WidgetConfig`/`Dashboard`
del Backend: el widget `CHART` y esta pantalla son caminos paralelos e independientes.

### Criterios de aceptación frontend

1. La pantalla "Históricos" es accesible desde un ítem propio de la sidebar, visible para
   cualquier `User` autenticado.
2. Un `AdminCliente` puede seleccionar hasta 8 Signals de cualquiera de sus Machines y ver sus
   históricos superpuestos en un único gráfico con leyenda, sin ver nunca un selector de Company.
3. Un `SuperAdmin` no puede seleccionar ninguna Signal hasta elegir explícitamente una Company;
   cambiar de Company limpia siempre la selección y cualquier serie ya cargada.
4. Intentar seleccionar una novena Signal está bloqueado en la propia UI, sin llegar a disparar
   una petición al Backend.
5. Cambiar el rango temporal repite la comparativa con la misma selección de Signals, sin
   recargar la pantalla completa.
6. Una Signal sin datos en el rango elegido se comunica explícitamente en su propia entrada de
   leyenda, sin romper el resto del gráfico.
7. Un fallo de red o del Backend al solicitar la comparativa se comunica con un estado de error y
   una acción de reintento, nunca de forma silenciosa ni con un gráfico vacío ambiguo.
