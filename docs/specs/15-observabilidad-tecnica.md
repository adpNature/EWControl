# Spec: Observabilidad técnica (health checks, métricas, alerting de infraestructura)

> Sin Frontend: es una funcionalidad puramente backend/infraestructura, sin pantalla propia en Angular (`docs/specs/README.md:84`, "no sigue el patrón de feature vertical Back+Front"). Los paneles de operación viven en Grafana, no en el Frontend de EWControl; ningún módulo de `frontend/src/app/` se modifica en esta spec.

## Contexto

`docs/07-observabilidad-monitorizacion.md` define la observabilidad de la propia plataforma EWControl —logs centralizados, métricas técnicas, alerting de infraestructura, health checks y trazabilidad end-to-end—, distinta del Alarm Engine (`docs/02-arquitectura.md`, apartado 2.8), que supervisa el **negocio del cliente**, no la salud del sistema (doc 07, "Alarmas Industriales frente a Alertas de Sistema"). Hasta esta spec, ninguno de los cinco apartados de ese documento tiene implementación real:

- **Logs (7.2)**: `nestjs-pino` ya está configurado (`backend/src/frameworks-drivers/app.module.ts:34-52`) con `redact` de campos sensibles y `pino-pretty` en desarrollo, cumpliendo ya la Regla 1 de 7.2. Pero no existe ningún `correlationId`/`correlation_id` en `backend/src` (cero coincidencias verificadas): la Regla 2 de 7.2 ("todo log estructurado incluye el `correlation_id`") no se cumple.
- **Health checks (7.5)**: no existe `@nestjs/terminus` en `backend/package.json` ni ningún controller de salud. `docker-compose.yml` ya define `healthcheck` para `postgres` (`pg_isready`, líneas 10-14) e `influxdb` (`influx ping`, líneas 26-30), pero el servicio `backend` (líneas 43-65) no tiene ninguno.
- **Métricas (7.3)**: no hay `prom-client` ni ningún endpoint `/metrics`.
- **Alerting (7.4)**: no hay Prometheus, Grafana ni Alertmanager en `docker-compose.yml`.
- **Trazabilidad end-to-end (7.6)**: el diagrama canónico del flujo completo (`docs/09-conclusion-vision-global.md:105`, `Provider->>Engine: Variable (correlation_id)`) ya anota el origen del `correlation_id` en el Data Provider, pero el pipeline real (`IngestSignalTickUseCase`, `backend/src/use-cases/dashboard/ingest-signal-tick.use-case.ts`) no lo genera ni lo propaga.

**Estado de referencia de `docs/05-despliegue-infraestructura.md`.** Ese documento declara explícitamente (líneas 30-35) que sus apartados 5.3 (Kubernetes), 5.5 (escalado/balanceador), 5.6 (réplica/failover de bases de datos) y 5.8 (alta disponibilidad) son "diseño de referencia — diferido hasta que exista la necesidad real": el proyecto opera con una sola instancia de cada servicio en Docker Compose, sin balanceador ni réplicas del Backend. Esto acota directamente el alcance de esta spec: cualquier condición de `docs/07-observabilidad-monitorizacion.md` que dependa de un balanceador real, de réplicas del Backend o de failover de PostgreSQL no es implementable ni verificable hoy, y se excluye explícitamente más abajo (misma disciplina de exclusión explícita que `docs/specs/13-motor-formulas-signal-engine.md`, apartado "Alcance explícito de esta spec").

**Alcance explícito de esta spec** (principio "evolución controlada", Documento 1):

1. Se implementan las cinco áreas de `docs/07-observabilidad-monitorizacion.md` en la medida en que son verificables en un despliegue Docker Compose de una sola instancia por servicio: `correlation_id` end-to-end, health checks liveness/readiness, métricas Prometheus, reglas de alerting (sin canal de entrega real) y el stack Prometheus + Grafana + Alertmanager en `docker-compose.yml`.
2. Queda fuera, por depender de infraestructura no desplegada (`docs/05-despliegue-infraestructura.md:30-35`): la condición de alerta "PostgreSQL realiza un failover" (no existe réplica ni failover en este entorno) y cualquier verificación de reinicio/retiro de tráfico por un balanceador real (no existe balanceador; el `healthcheck` de Docker Compose gestiona un único contenedor `backend`).
3. Queda fuera: la condición de alerta "uso de disco de InfluxDB supera el umbral de capacidad" — exigiría un exporter de disco/host (tipo `node-exporter`) sobre el volumen `influxdb_data`, una preocupación de topología de producción fuera de alcance mientras el proyecto no tenga esa infraestructura real.
4. Queda fuera: métrica de "evaluaciones/s" del Alarm Engine — solo es observable instrumentando `EvaluateAlarmRulesUseCase` (capa `use-cases/`) con un puerto de métricas nuevo; esta spec evita acoplar infraestructura pura a un caso de uso de negocio sin necesidad operativa real ya identificada.
5. Queda fuera: métrica de "reintentos" del Data Provider — `SimulationProvider` (`backend/src/interface-adapters/data-providers/simulation/simulation-provider.ts`) no tiene ninguna lógica de reconexión (no hay red real que falle); sin valor observable hasta que exista un Data Provider real (Fase 12 del Roadmap, OPC UA).
6. Queda fuera: la entrega real de alertas a un canal (Slack, email, PagerDuty). Se definen las reglas y la agrupación de Alertmanager como configuración versionada, con un receiver `null-receiver` sin integración funcional, documentado explícitamente como placeholder de una spec futura. No se reutiliza Mailpit: doc 07, Regla 1 de 7.4, exige un canal exclusivo para el equipo operador, distinto del Notification Service de alarmas industriales (`docs/02-arquitectura.md`, apartado 2.10).
7. El campo `correlationId` se propaga hasta el evento `SignalUpdated` publicado al Frontend (doc 07, Regla 2 de 7.6: "ningún componente descarta el `correlation_id` al reenviar"), ampliando de forma aditiva el contrato ya catalogado en `docs/11-api-rest.md:222`. Los eventos `AlarmTriggered`/`AlarmCleared`/`AlarmAcked` (`backend/src/use-cases/simulator-control/ports/event-publisher.port.ts:28-53`) quedan explícitamente fuera de este campo: son eventos de dominio nuevos (una activación de alarma), no una retransmisión de la misma Variable que originó el tick.

## Actor(es)

**Sistema**: el propio pipeline de ingesta de datos (`SimulationProvider` → `IngestSignalTickUseCase` → `RealtimeGateway`), como origen y propagador del `correlationId`, y el propio Backend, que expone sus endpoints de salud y métricas para ser consultados por Docker (healthcheck) y Prometheus (scrape). El **equipo que opera la plataforma** es el destinatario de las alertas de infraestructura (nunca el cliente de EWControl), pero no interactúa mediante ningún endpoint de esta spec: consume Grafana/Alertmanager, herramientas externas a EWControl.

## Precondiciones

- El entorno se levanta con `docker compose up -d` (README, sección c); los servicios `postgres`, `influxdb`, `mailpit`, `backend`, `frontend` ya existen en `docker-compose.yml`.
- Existe al menos una Machine activa con Signals configuradas y el Simulador generando ticks (`docs/specs/02-simulador-generar-lectura.md`), para que el `correlationId` tenga un flujo real que recorrer.
- `InfluxDB 2.x` expone su endpoint `/health` (usado ya por el healthcheck `influx ping` de `docker-compose.yml:26-30`) y su endpoint nativo `/metrics` en formato Prometheus, sin necesidad de un exporter dedicado (a confirmar de forma puntual contra `http://localhost:8086/metrics` al implementar esta spec).

## Backend

### Flujo principal (Given/When/Then)

**Trazabilidad end-to-end (correlation_id)**

- **Given** el Simulador generando ticks para una Machine activa (`SimulationProvider.tick()`, `backend/src/interface-adapters/data-providers/simulation/simulation-provider.ts:68-85`).
- **When** se genera un nuevo valor de Variable en un ciclo de `tick()`.
- **Then** se le asigna un `correlationId` (`crypto.randomUUID()`, sin dependencia npm nueva) único por Variable y por ciclo, añadido al tipo `Variable` (`backend/src/interface-adapters/data-providers/variable.vo.ts:9-15`); ese mismo `correlationId` se propaga como parámetro explícito a `IngestSignalTickInput` (`ingest-signal-tick.use-case.ts:32-38`), a la `RealtimeCacheEntry` resultante (`backend/src/entities/realtime-cache.ts:10-18`) y al evento `SignalUpdated` (`SignalUpdatedPayload`, `backend/src/use-cases/simulator-control/ports/event-publisher.port.ts:14-21`), sin romper el contrato ya existente de ninguno de esos tipos (campo añadido, no sustituido).

- **Given** un `correlationId` generado para un tick.
- **When** `IngestSignalTickUseCase`, `AlarmEvaluationListener` (`backend/src/interface-adapters/events/alarm-evaluation.listener.ts`) y `RealtimeGateway` (`backend/src/interface-adapters/websocket/realtime.gateway.ts`) procesan ese tick o el evento derivado.
- **Then** cada uno registra un log estructurado que incluye `correlationId` como campo propio (`logger.log({ correlationId, ... }, mensaje)`, no interpolado en el string del mensaje — sustituye el patrón actual de `this.logger.error(\`...\`)`en`ingest-signal-tick.use-case.ts:211`), permitiendo reconstruir el recorrido completo del dato consultando los logs por `correlationId` (doc 07, "Caso de Uso" de 7.6).

- **Given** el evento `SignalUpdated` publicado con su `correlationId`.
- **When** `RealtimeGateway.relaySignalUpdated` (`realtime.gateway.ts:44-53`) lo reemite por WebSocket al Frontend.
- **Then** el payload emitido al cliente incluye `correlationId` junto a `signalId`, `machineId`, `value`, `quality`, `timestamp` — ampliación aditiva del contrato de `docs/11-api-rest.md:222`.

- **Given** una petición HTTP cualquiera contra la API REST.
- **When** `pino-http` (vía `LoggerModule.forRoot`, `app.module.ts:34-52`) genera su `req.id` interno (`genReqId`).
- **Then** ese identificador se expone con el mismo nombre de campo `correlationId` que usa el pipeline de ticks, mediante `customProps: (req) => ({ correlationId: req.id })`, y se devuelve en la respuesta como header `X-Correlation-Id` — unifica el **nombre del campo** de correlación en toda la plataforma (doc 07, apartado 7.2), sin implicar que una petición HTTP y un tick compartan el mismo mecanismo de generación.

**Health checks**

- **Given** el Backend en ejecución, independientemente del estado de sus dependencias.
- **When** se consulta `GET /health/live`.
- **Then** responde `200 { status: 'ok' }` de forma directa, sin ejecutar ningún indicator de `@nestjs/terminus` — la liveness es deliberadamente el camino de código más simple posible, para que un fallo de sus propias comprobaciones nunca provoque un reinicio en cascada (doc 07, apartado 7.5, "Liveness: su fallo provoca el reinicio automático del componente").

- **Given** PostgreSQL e InfluxDB accesibles.
- **When** se consulta `GET /health/ready`.
- **Then** responde `200` únicamente si `TypeOrmHealthIndicator.pingCheck('postgres')` (indicator built-in de Terminus sobre la conexión ya registrada en `app.module.ts:22-25`) y un `InfluxDbHealthIndicator` propio (`backend/src/interface-adapters/persistence/influxdb/influxdb-health.indicator.ts`, contra el endpoint nativo `/health` de InfluxDB) responden correctamente.

- **Given** PostgreSQL o InfluxDB inaccesibles.
- **When** se consulta `GET /health/ready`.
- **Then** responde `503`, sin afectar a `GET /health/live` (que sigue en `200`) — un fallo de readiness nunca reinicia el proceso, solo indicaría a un balanceador (inexistente hoy) que no le envíe tráfico (doc 07, Regla 2 de 7.5).

- **Given** el servicio `backend` de `docker-compose.yml`.
- **When** se levanta con `docker compose up -d`.
- **Then** su definición incluye un `healthcheck` que ejecuta `wget --spider http://localhost:3000/health/live` (BusyBox de `node:20-alpine`, `docker/backend.Dockerfile:5`, trae `wget` pero no `curl`), con el mismo patrón de `interval`/`timeout`/`retries` que ya usan `postgres` e `influxdb` (`docker-compose.yml:10-14`, `26-30`).

**Métricas**

- **Given** el Backend en ejecución con Signals actualizándose, alarmas activas y peticiones HTTP entrantes.
- **When** se consulta `GET /metrics`.
- **Then** responde en formato Prometheus (`prom-client`) incluyendo, como mínimo: `ewcontrol_signal_updates_total` y `ewcontrol_alarm_events_total{event}` (incrementados en `RealtimeGateway`, sin tocar ningún caso de uso), `ewcontrol_data_provider_connected{machine_id}` (Gauge derivado del estado de `SimulationProviderRegistry`), `ewcontrol_alarm_active_total` (Gauge, `COUNT(*) FROM alarm_states WHERE status = 'ACTIVE'`, barato gracias al índice `@Index(['status'])` de `backend/src/entities/alarm-state.entity.ts:24`), `ewcontrol_http_requests_total{method,route,status_code}` y `ewcontrol_http_request_duration_seconds{method,route,status_code}` (Counter/Histogram vía middleware), y `ewcontrol_history_write_errors_total` (Counter).
- Ninguna de estas métricas se calcula importando `prom-client` dentro de `entities/` o `use-cases/`: la única modificación de Entities es el método puro `IRealtimeCache.size(): number` (`realtime-cache.ts:20-23`, sin I/O); todo lo demás se instrumenta desde `interface-adapters/`.

- **Given** un fallo al escribir un punto de histórico en InfluxDB (`writeHistoryIfEnabled`, `ingest-signal-tick.use-case.ts:251-275`, `catch` silencioso de las líneas 271-274).
- **When** ese fallo ocurre.
- **Then** se incrementa `ewcontrol_history_write_errors_total` mediante un puerto nuevo `IMetricsRecorder` (`backend/src/use-cases/observability/ports/metrics-recorder.port.ts`, mismo patrón que `IEventPublisher`/`IHistoryWriter`), sin alterar el descarte silencioso ya documentado en `docs/04-persistencia-de-datos.md`, apartado 4.8 ("Tolerancia a Fallos"): el tiempo real sigue sin verse afectado, pero el fallo pasa a ser observable en `/metrics`.

- **Given** PostgreSQL e InfluxDB.
- **When** Prometheus scrapea la plataforma.
- **Then** además de `/metrics` del backend, scrapea `prometheuscommunity/postgres-exporter` (Postgres no expone métricas Prometheus nativamente) y el endpoint `/metrics` nativo de InfluxDB 2.x (sin exporter dedicado, ya expuesto por la propia imagen oficial).

**Alerting**

- **Given** las reglas de `observability/prometheus/rules/ewcontrol.rules.yml`.
- **When** el backend deja de responder (`up{job="backend"} == 0`) durante más de 1 minuto.
- **Then** se dispara la alerta `BackendDown` con severidad `critical` (doc 07, tabla de 7.4, primera fila).

- **Given** las mismas reglas.
- **When** el percentil 95 de `ewcontrol_http_request_duration_seconds` supera el umbral configurado durante 5 minutos, o `ewcontrol_data_provider_connected` permanece en `0` más del tiempo esperado configurado, o `ewcontrol_history_write_errors_total` aumenta en una ventana de 5 minutos, o `up{job="influxdb"} == 0` durante 1 minuto.
- **Then** se disparan, respectivamente, `BackendHighLatency` (`high`), `DataProviderDisconnected` (`media`) e `InfluxDbWriteFailures`/`InfluxDbDown` (`high`) — correspondientes a las filas 2, 5 y 4 de la tabla de condiciones de 7.4.

- **Given** varias alertas de la misma causa raíz disparándose en un corto periodo.
- **When** Alertmanager las procesa.
- **Then** se agrupan por `alertname` (`group_by`, `group_wait`, `group_interval`, `repeat_interval` configurados en `observability/alertmanager/alertmanager.yml`) antes de considerarse para notificación, cumpliendo la Regla 2 de 7.4 ("toda alerta crítica se agrupa para evitar saturar al equipo operador"), aunque el receiver configurado (`null-receiver`) no realice ninguna entrega real.

### Casos borde / errores (Given/When/Then)

- **Given** una `FORMULA` cuya evaluación falla (división por cero, Variable no numérica) y publica `SignalUpdated` con el último valor válido y calidad `BAD` (`handleFormulaEvaluationError`, `ingest-signal-tick.use-case.ts:204-223`).
- **When** ese evento se re-emite.
- **Then** conserva el `correlationId` del tick que provocó el error, igual que conserva su `timestamp` — el error de cálculo no interrumpe la trazabilidad end-to-end.

- **Given** un tick para una Machine inexistente/inactiva, o una Variable sin ninguna Signal `DIRECT`/`FORMULA` asociada (`ingest-signal-tick.use-case.ts:78-117`).
- **When** el Signal Engine lo procesa y lo descarta silenciosamente (comportamiento ya existente, sin cambios).
- **Then** el `correlationId` generado para ese tick no se propaga a ningún sitio (no hay `RealtimeCacheEntry` ni `SignalUpdated` que lo lleve); no se registra como error, mismo criterio que el descarte silencioso ya documentado en `docs/specs/13-motor-formulas-signal-engine.md`.

- **Given** el Backend arrancando, antes de que la conexión con PostgreSQL/InfluxDB se establezca.
- **When** se consulta `GET /health/live` en ese instante.
- **Then** responde `200` igualmente (no depende de esas conexiones); `GET /health/ready` responde `503` hasta que ambas estén disponibles — evita que el proceso se reinicie durante su propio arranque por una readiness aún no cumplida.

- **Given** el receiver `null-receiver` de Alertmanager, sin ninguna integración de entrega configurada.
- **When** se dispara cualquier alerta.
- **Then** la alerta queda visible en la UI de Alertmanager (`http://localhost:9093`) y agrupada según sus reglas, pero no se envía a ningún canal externo — comportamiento esperado y documentado, no un fallo de configuración.

- **Given** las condiciones de alerta "PostgreSQL realiza un failover" y "uso de disco de InfluxDB supera el umbral" del doc 07.
- **When** se implementan las reglas de Prometheus de esta spec.
- **Then** ninguna de las dos tiene una regla correspondiente: no existe réplica/failover de PostgreSQL ni exporter de disco desplegado en este entorno (`docs/05-despliegue-infraestructura.md:30-35`); se documentan explícitamente como pendientes, no se simulan con una condición que nunca podría evaluarse de forma realista.

### Contrato de entrada/salida

Nuevos endpoints, sin autenticación (infraestructura interna, consumida por Docker/Prometheus, no por el Frontend) y excluidos del prefijo versionado (`backend/src/main.ts:16`, `app.setGlobalPrefix('api/v1', { exclude: ['health/(.*)', 'metrics'] })`):

| Método | Ruta            | Respuesta                                                             |
| ------ | --------------- | --------------------------------------------------------------------- |
| GET    | `/health/live`  | `200 { status: 'ok' }` siempre que el proceso responda.               |
| GET    | `/health/ready` | `200` si PostgreSQL e InfluxDB responden; `503` en caso contrario.    |
| GET    | `/metrics`      | Texto plano formato Prometheus (`prom-client`), consumido por scrape. |

Modificación aditiva de contrato ya catalogado en `docs/11-api-rest.md:222`: el evento WebSocket `SignalUpdated` pasa de `{ signalId, machineId, value, quality, timestamp }` a `{ signalId, machineId, value, quality, timestamp, correlationId }`. No incrementa la versión de la API (convención ya fijada en `docs/11-api-rest.md`, "Base URL y versionado": los campos nuevos opcionales no rompen contrato).

Se corrige `docs/11-api-rest.md:222` para reflejar este campo nuevo, y se traslada la fila 15 de la tabla "Pendientes" (`docs/specs/README.md:82-84`) al Índice principal (`docs/specs/README.md:59-76`), mismo mantenimiento documental que aplicó la spec 13 sobre referencias obsoletas.

### Criterios de aceptación backend

1. `SimulationProvider.tick()` asigna un `correlationId` (UUID) distinto por Variable y por ciclo de generación.
2. `IngestSignalTickUseCase` propaga el `correlationId` de entrada a la `RealtimeCacheEntry` resultante y al evento `SignalUpdated`, tanto para Signals `DIRECT` como `FORMULA`, incluyendo el camino de error de una `FORMULA` (`handleFormulaEvaluationError`).
3. Un tick descartado (Machine inexistente/inactiva, Variable sin Signal asociada) no propaga su `correlationId` a ningún componente downstream.
4. `IngestSignalTickUseCase`, `AlarmEvaluationListener` y `RealtimeGateway` registran logs estructurados (objeto, no interpolación de string) que incluyen `correlationId` cuando procesan un tick o un evento derivado de él.
5. Una petición HTTP sin correlación previa recibe un `correlationId` (derivado de `req.id` de `pino-http`) devuelto en el header `X-Correlation-Id` de la respuesta.
6. `RealtimeGateway` reemite `SignalUpdated` al Frontend incluyendo `correlationId`, sin alterar el resto de campos ya contratados.
7. `GET /health/live` responde `200` sin invocar ningún indicator de PostgreSQL/InfluxDB.
8. `GET /health/ready` responde `200` cuando PostgreSQL e InfluxDB están disponibles, y `503` cuando cualquiera de los dos falla, sin afectar a `GET /health/live`.
9. `IRealtimeCache.size()` devuelve el número de entradas actuales de la Realtime Cache.
10. `GET /metrics` expone, en formato `prom-client`, como mínimo: `ewcontrol_signal_updates_total`, `ewcontrol_alarm_events_total`, `ewcontrol_data_provider_connected`, `ewcontrol_alarm_active_total`, `ewcontrol_http_requests_total`, `ewcontrol_http_request_duration_seconds` y `ewcontrol_history_write_errors_total`.
11. `ewcontrol_alarm_active_total` refleja el número real de `AlarmState` con `status = 'ACTIVE'` en PostgreSQL (verificado contra una base de datos real, test de integración).
12. Un fallo de `IHistoryWriter.writeBatch` incrementa `ewcontrol_history_write_errors_total` sin alterar el descarte silencioso ya existente (el tiempo real no se ve afectado).
13. Ninguna dependencia de métricas (`prom-client`) ni de health checks (`@nestjs/terminus`) se importa dentro de `backend/src/entities/` ni se introduce como dependencia directa de un caso de uso salvo a través del puerto `IMetricsRecorder` ya acotado al fallo de escritura en InfluxDB.
14. El servicio `backend` de `docker-compose.yml` tiene un `healthcheck` propio (`wget` contra `/health/live`), con el mismo patrón de `interval`/`timeout`/`retries` que `postgres`/`influxdb`.
15. `docker-compose.yml` añade los servicios `prometheus`, `grafana`, `alertmanager` y `postgres-exporter`, con su configuración versionada en `observability/`, sin modificar los servicios existentes salvo el `healthcheck` de `backend`.
16. Las reglas de Prometheus (`observability/prometheus/rules/ewcontrol.rules.yml`) cubren `BackendDown`, `BackendHighLatency`, `DataProviderDisconnected`, `InfluxDbWriteFailures` e `InfluxDbDown`, y **no** incluyen ninguna regla para "failover de PostgreSQL" ni "disco de InfluxDB", documentando explícitamente su exclusión.
17. Alertmanager agrupa alertas por `alertname` según `group_by`/`group_wait`/`group_interval`/`repeat_interval`, con un único receiver `null-receiver` sin integración de entrega real configurada.
18. `docs/11-api-rest.md:222` documenta `correlationId` como campo del evento `SignalUpdated`; `docs/specs/README.md` traslada esta spec de "Pendientes" al Índice.

## Verificación no cubierta por TDD (infraestructura/despliegue)

Coherente con la separación de niveles de test de `docs/00-metodologia-y-calidad.md` ("Pirámide de Testing"), los siguientes puntos no tienen equivalente en Vitest y se verifican manualmente tras `docker compose up -d`, documentado aquí para no confundirlos con criterios de aceptación TDD:

- Que Prometheus scrapea correctamente `backend`, `postgres-exporter` e InfluxDB (UI `http://localhost:9090/targets`, todos en estado `UP`).
- Que Grafana muestra paneles con datos reales de esas fuentes (verificación visual).
- Que Alertmanager agrupa alertas reales y que su `null-receiver` no realiza ninguna entrega (forzando, por ejemplo, la parada del contenedor `backend` y observando la UI de Alertmanager).
- Que el `healthcheck` de Docker Compose marca `unhealthy` y reinicia el contenedor `backend` cuando `/health/live` deja de responder.
- Validez sintáctica de las reglas YAML de Prometheus (`promtool check rules`), tarea de CI/CLI, no de Vitest.
- Disponibilidad real del endpoint `/metrics` nativo de InfluxDB 2.x, a confirmar una única vez durante la implementación.
