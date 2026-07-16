# Spec: Motor de fórmulas del Signal Engine (Signals `FORMULA`)

> Sin Frontend: es una feature de fundación del Signal Engine sin interfaz propia (`docs/specs/README.md:57`). Todo el consumo visual (widgets `VALUE`/`GAUGE`/`TABLE`/`CHART`, panel de alarmas, WebSocket) ya lee del contrato genérico de la Realtime Cache sin distinguir `signalType`, así que no requiere ningún cambio de UI.

## Contexto

El Signal Engine (`docs/02-arquitectura.md`, apartado 2.5) enumera entre sus responsabilidades "Calcular Signals de tipo DIRECT" y "Calcular Signals de tipo FORMULA" (`docs/02-arquitectura.md:1419-1420`), pero su wiring real (`IngestSignalTickUseCase`, `backend/src/use-cases/dashboard/ingest-signal-tick.use-case.ts`) resuelve hoy **únicamente** Signals `DIRECT`: filtra por `signal_type = 'DIRECT'` directamente en la query SQL (`findActiveDirectByMachineAndVariableName`, `backend/src/use-cases/seed-demo-environment/ports/signal-repository.port.ts:22-27`), así que una Signal `FORMULA` nunca es vista por el Signal Engine, ni siquiera con una rama `if`. El cálculo se delega en `resolveDirectSignalValue` (`backend/src/entities/signal-engine.ts:26-28`), hoy un mapeo identidad cuyo comentario ya anticipa este paso: _"Es el único punto donde un futuro evaluador de Signals `FORMULA` se conectaría, sin modificar a quien llama"_ (`backend/src/entities/signal-engine.ts:22-24`).

Esto quedó diferido explícitamente por las dos specs anteriores del Signal Engine, sin rediseñar nada (principio de "evolución controlada", Documento 1):

- La spec 07: _"Signals `FORMULA` quedan sin valor en tiempo real (…) se trata exactamente igual que una Signal `DIRECT` que aún no ha recibido su primer tick — sin ninguna rama de código por `signalType`. Evaluar expresiones `FORMULA` queda para una spec futura del Signal Engine"_ (`docs/specs/07-dashboard-tiempo-real.md:11`).
- La spec 08: _"Evaluar Signals `FORMULA` sigue fuera de alcance (…); una Signal `FORMULA` nunca genera puntos de histórico porque nunca recibe ticks del Signal Engine"_ (`docs/specs/08-historicos.md:22`).

El modelo de dominio ya está cerrado: `SignalType.DIRECT | FORMULA` (`backend/src/entities/signal-type.enum.ts`), y `FormulaSignalSource = { expression: string; variables: string[] }` ya persistido en `Signal.signalSource` (columna `jsonb`) desde la spec 06 (`backend/src/entities/signal-source.vo.ts:12-15`). La regla de dominio ya está fijada: _"Una Signal de tipo FORMULA únicamente puede referenciar Variables de la misma Machine"_ (`docs/03-modelo-de-datos.md:1108`, Regla 2 del apartado 3.2.5) — cada `FORMULA` depende solo de Variables crudas de su propia Machine, nunca de otras Signals ni de otras Machines: no hay fórmulas encadenadas ni motor de dependencias (`docs/02-arquitectura.md:1487`, _"No existirá un motor avanzado de dependencias"_).

Hoy la validación de escritura es parcial: `findUnknownVariables` (`backend/src/entities/signal-source.vo.ts:23-28`), usada por `CreateSignalUseCase`/`UpdateSignalUseCase` (`backend/src/use-cases/machine-management/create-signal.use-case.ts`, `.../update-signal.use-case.ts`), solo comprueba que los nombres de `variables` existan entre las Variables conocidas de la `MachineConnection` (error `422 FORMULA_REFERENCES_UNKNOWN_VARIABLE`), pero nunca parsea ni evalúa `expression`. Esta spec añade esa validación sintáctica en escritura, además de la evaluación real en tiempo de tick.

**Downstream ya generalizado, sin cambios necesarios.** Una vez que el Signal Engine escriba en la Realtime Cache (`backend/src/entities/realtime-cache.ts`) el valor de una `FORMULA` con el mismo contrato `{ signalId, machineId, companyId, value, quality, timestamp, updatedAt }` que una `DIRECT`, y publique `SignalUpdated`, todo lo demás funciona sin tocarse:

- `MarkMachineSignalsOfflineUseCase` (`backend/src/use-cases/dashboard/mark-machine-signals-offline.use-case.ts:33-57`) itera `findAllByMachineId` sin filtrar por `signalType` y solo actúa si ya hay entrada en la Realtime Cache — cubre `FORMULA` gratis en cuanto tenga entradas.
- `AlarmEvaluationListener` (`backend/src/interface-adapters/events/alarm-evaluation.listener.ts`) reacciona a `SignalUpdated` sin filtrar por tipo — cubre `FORMULA` gratis.
- `GET .../signals/:id/value` y el WebSocket ya leen de la Realtime Cache sin distinguir tipo (`docs/specs/07-dashboard-tiempo-real.md:77-79`).
- `GET .../signals/:id/history` ya devuelve `points: []` cuando no hay datos (`docs/specs/08-historicos.md:62-64`); a partir de esta spec, una `FORMULA` con `historyEnabled: true` sí generará puntos, reutilizando el mismo guard `historyEnabled && typeof value === 'number'` ya existente (`backend/src/use-cases/dashboard/ingest-signal-tick.use-case.ts:96`), sin código nuevo de histórico.

**Problema de diseño central.** Una fórmula típica (`Potencia = Voltage * Current`) depende de varias Variables, pero cada tick del Data Provider trae el valor de una sola (`SimulationProvider.tick()`, `backend/src/interface-adapters/data-providers/simulation/simulation-provider.ts:68-85`, emite una llamada independiente por Variable, sin lote atómico, aunque compartan el mismo `timestamp` de ciclo). Hoy no existe ningún almacén del "último valor conocido de cada Variable cruda por Machine": la Realtime Cache está keyed por `signalId` y solo guarda Signals, y no toda Variable de una fórmula tiene necesariamente una Signal `DIRECT` que la exponga. Sin ese almacén no se puede evaluar una fórmula multi-variable al llegar el tick de solo una de sus variables.

**Alcance explícito de esta spec** (principio "evolución controlada", Documento 1):

1. Se implementa el ciclo completo de la Signal `FORMULA`: memorización del último valor de cada Variable cruda por Machine, evaluación segura de la expresión aritmética, cálculo de calidad/timestamp del resultado, gestión de errores de cálculo, escritura en la Realtime Cache y publicación de `SignalUpdated` — reutilizando todo el downstream ya existente (alarmas, históricos, desconexión, REST, WebSocket) sin modificarlo. También se añade validación sintáctica de `expression` al crear/editar una Signal `FORMULA`.
2. Queda fuera, por ser evolución futura ya documentada: fórmulas que referencian **otras Signals** en vez de solo Variables (`docs/03-modelo-de-datos.md:1129`, _"Fórmulas más complejas o dependientes de otras Signals"_), y por tanto cualquier grafo de dependencias entre Signals o recálculo encadenado (`docs/02-arquitectura.md:1487`).
3. Queda fuera: fórmulas derivadas de Variables de **varias Machines** (`docs/03-modelo-de-datos.md:1130`, _"Signals derivadas de varias Machines"_). Toda Variable de una fórmula pertenece a la misma Machine que la Signal (`docs/03-modelo-de-datos.md:1108`).
4. Queda fuera: **funciones matemáticas avanzadas** (trigonometría, potencias, logaritmos, funciones estadísticas, condicionales). Solo se soportan las "operaciones simples" de `docs/02-arquitectura.md:1485`: suma, resta, multiplicación, división, paréntesis y negación unaria sobre literales numéricos y nombres de Variable.
5. Queda fuera: la **conversión automática de unidades** (`docs/03-modelo-de-datos.md:1128`); la `unit` de una Signal `FORMULA` es puramente informativa, igual que en una `DIRECT`.
6. **Corrección documental incluida en esta entrega:** `docs/specs/09-alarmas.md:24-25` todavía referencia _"spec tentativa 12"_ (motor de fórmulas) y _"spec tentativa 13"_ (históricos independientes), numeración obsoleta frente al Índice de `docs/specs/README.md:82-83`, que ya las numera como **13** y **14**. Se actualiza `docs/specs/09-alarmas.md:24` a "spec 13" y `docs/specs/09-alarmas.md:25` a "spec 14".

## Actor(es)

**Sistema**: el propio Signal Engine (`IngestSignalTickUseCase`), como actor automático, al procesar cada tick de una Variable emitido por un Data Provider (hoy solo el Simulador). No hay usuario humano en el flujo principal de esta spec. Un `AdminCliente`/`SuperAdmin` interviene solo indirectamente al crear/editar una Signal `FORMULA` (spec 06), cuyo endpoint esta spec endurece con validación sintáctica de la expresión.

## Precondiciones

- Existen Machines y Signals configuradas (`docs/specs/06-gestion-machines-signals.md`), incluida al menos una Signal `FORMULA` activa cuya `signalSource.variables` referencia Variables conocidas de la `MachineConnection` de su Machine (`docs/03-modelo-de-datos.md:1108`).
- El Signal Engine está recibiendo ticks de esas Variables (`docs/specs/07-dashboard-tiempo-real.md:31-33`); una Signal `FORMULA` no se crea sobre Variables que la Machine no emite (ya garantizado por `findUnknownVariables`, `backend/src/entities/signal-source.vo.ts:23-28`).
- La Realtime Cache es una única instancia compartida en toda la aplicación (`backend/src/entities/realtime-cache.ts:25-31`).

## Backend

### Flujo principal (Given/When/Then)

- **Given** una Machine activa con una Signal `FORMULA` activa `Potencia` cuya `signalSource = { expression: "Voltage * Current", variables: ["Voltage", "Current"] }`, y en la que ambas Variables `Voltage` y `Current` ya tienen un último valor conocido con calidad `GOOD` (p. ej. `230` y `12`).
- **When** el Signal Engine procesa un tick de cualquiera de esas dos Variables.
- **Then** memoriza primero el valor/calidad/timestamp del tick recibido en el almacén interno de últimos valores de Variable cruda por Machine, localiza las Signals `FORMULA` activas de esa Machine cuya `variables` incluye la Variable del tick, evalúa `"Voltage * Current"` con los últimos valores conocidos de ambas (`230 * 12 = 2760`), y actualiza la Realtime Cache y publica `SignalUpdated` para `Potencia` con el mismo contrato `{ signalId, machineId, companyId, value, quality, timestamp, updatedAt }` que una `DIRECT` (mismo ejemplo end-to-end que `docs/02-arquitectura.md:1595-1627`).

- **Given** un tick de una Variable a la que corresponde tanto una Signal `DIRECT` como el ser referenciada por una o varias Signals `FORMULA` de la misma Machine.
- **When** el Signal Engine procesa el tick.
- **Then** resuelve ambos caminos en el mismo ciclo, de forma independiente: actualiza la Signal `DIRECT` (comportamiento ya existente, sin cambios observables) y cada Signal `FORMULA` afectada; cada Signal actualizada produce su propia entrada en la Realtime Cache y su propio `SignalUpdated`.

- **Given** una Variable referenciada por una `FORMULA` que no tiene ninguna Signal `DIRECT` que la exponga.
- **When** llega su tick.
- **Then** el Signal Engine igualmente memoriza su valor en el almacén interno de Variables (para que las fórmulas puedan usarlo), aunque no exista ninguna entrada `DIRECT` correspondiente en la Realtime Cache: ese almacén interno nunca es accesible vía REST, WebSocket ni Alarmas.

- **Given** una Signal `FORMULA` activa con `historyEnabled: true` cuyo resultado evaluado es numérico.
- **When** el Signal Engine la actualiza.
- **Then** además de la Realtime Cache y `SignalUpdated`, escribe el punto `{ companyId, machineId, signalId, value, timestamp }` en InfluxDB vía el mismo `IHistoryWriter.writeBatch` y bajo el mismo guard `historyEnabled && typeof value === 'number'` ya existente (`backend/src/use-cases/dashboard/ingest-signal-tick.use-case.ts:96-111`), con el mismo descarte silencioso ante fallo de InfluxDB (`docs/specs/08-historicos.md`, "Tolerancia a Fallos").

- **Given** una Machine con una Signal `FORMULA` que ya tiene entrada en la Realtime Cache, que se desconecta (`POST .../simulator/force-disconnect`, spec 03).
- **When** se publica `MachineDisconnected` y actúa `MarkMachineSignalsOfflineUseCase`.
- **Then** la Signal `FORMULA` pasa a `quality: "OFFLINE"` conservando su último `value`/`timestamp`, igual que una `DIRECT`, sin ningún código nuevo (ya cubierto: itera todas las Signals de la Machine sin filtrar por tipo y solo actúa si hay entrada previa en la Realtime Cache).

### Casos borde / errores (Given/When/Then)

- **Given** una Signal `FORMULA` `Potencia = Voltage * Current` donde `Voltage` ya tiene valor conocido pero `Current` nunca ha tickeado (sin entrada en el almacén interno de Variables).
- **When** llega un tick de `Voltage`.
- **Then** el Signal Engine omite el cálculo de `Potencia` (no crea entrada en la Realtime Cache ni publica `SignalUpdated`), exactamente igual que una Signal `DIRECT` que aún no ha recibido su primer tick (`docs/specs/07-dashboard-tiempo-real.md:77-79`); no se usa ningún valor por defecto. El cálculo se realiza en cuanto `Current` reciba su primer tick.

- **Given** una `FORMULA` cuyas Variables de entrada tienen calidades distintas entre sí (p. ej. `Voltage` con calidad `GOOD` y `Current` con calidad `BAD`/`OFFLINE` por una degradación forzada, spec 03 `force-quality`) y timestamps distintos.
- **When** el Signal Engine la evalúa.
- **Then** el resultado recibe la **peor calidad** de las Variables efectivamente usadas, según el orden de severidad `GOOD < UNCERTAIN < BAD < OFFLINE` (`docs/02-arquitectura.md:1550-1555`), y el **timestamp más reciente** (máximo) entre ellas. La calidad viaja siempre junto al valor (`docs/02-arquitectura.md:1557`).

- **Given** una `FORMULA` `A / B` cuyas Variables de entrada son todas `GOOD` pero `B` vale `0` (división por cero), y la Signal ya tenía un último valor válido en la Realtime Cache.
- **When** el Signal Engine evalúa la expresión.
- **Then** aplica la regla de errores de `docs/02-arquitectura.md:1631-1648`: mantiene el último `value` válido en la Realtime Cache, actualiza su calidad a `BAD` (error de cálculo; nunca `OFFLINE`, reservado a pérdida de comunicación), registra el error (Pino) y continúa procesando el resto de Signals; publica `SignalUpdated` reflejando la calidad `BAD` sobre el último valor conocido, con el timestamp del tick que provocó el error.

- **Given** la misma `FORMULA` con error de cálculo (división por cero, o una Variable con valor no numérico) que nunca tuvo un valor válido previo (sin entrada en la Realtime Cache).
- **When** el Signal Engine evalúa la expresión.
- **Then** omite la actualización por completo (no crea entrada en la Realtime Cache ni publica `SignalUpdated`) y registra el error: no hay "último valor válido" que mantener, y crear una entrada `BAD` sin `value` violaría el contrato de `RealtimeCacheEntry` (`backend/src/entities/realtime-cache.ts:10-18`). Mismo tratamiento observable que "sin primer tick".

- **Given** una `FORMULA` una de cuyas Variables de entrada tiene un valor no numérico (`boolean`/`string`) en su último tick conocido.
- **When** el Signal Engine intenta evaluarla.
- **Then** trata la evaluación como error de cálculo ("Tipo incorrecto", `docs/02-arquitectura.md:1639`) y aplica la misma regla de los dos casos anteriores según haya o no un valor previo válido. Nunca lanza una excepción que interrumpa el resto del procesamiento (`docs/02-arquitectura.md:1648`).

- **Given** el Simulador emitiendo en un mismo ciclo, secuencialmente y con el mismo `timestamp`, varias Variables que intervienen en la misma `FORMULA` (cada una en una llamada independiente al Signal Engine, sin lote atómico).
- **When** se procesan esas llamadas.
- **Then** la `FORMULA` se recalcula una vez por cada Variable suya que ticka en el ciclo, cada vez con los últimos valores conocidos; recalcular varias veces por ciclo es el comportamiento esperado (`docs/02-arquitectura.md:1654-1658`, _"El Signal Engine deberá procesar únicamente las Variables que cambien (…) Cada Variable será procesada de forma independiente"_), no un lote pendiente de resolver.

- **Given** un `AdminCliente` que crea o edita una Signal `FORMULA` con una `expression` sintácticamente inválida (paréntesis desbalanceados, operador colgante, token no reconocido) o que referencia en `expression` un nombre no incluido en `variables`.
- **When** llama a `POST .../signals` o `PATCH .../signals/:id` (`backend/src/use-cases/machine-management/create-signal.use-case.ts`, `.../update-signal.use-case.ts`).
- **Then** la API responde `422` con `code: "FORMULA_EXPRESSION_INVALID"`, adicional a la validación ya existente `422 FORMULA_REFERENCES_UNKNOWN_VARIABLE` (`backend/src/entities/signal-source.vo.ts:23-28`): la `expression` debe ser parseable por el evaluador y solo usar nombres declarados en `variables`.

- **Given** un tick para una Machine inexistente/inactiva, o una Variable que no corresponde a ninguna Signal (`DIRECT` ni `FORMULA`) de esa Machine.
- **When** el Signal Engine lo procesa.
- **Then** se comporta como hoy: descarta silenciosamente el camino `DIRECT` (`docs/specs/07-dashboard-tiempo-real.md:97-99`); para el camino `FORMULA`, tras memorizar el valor en el almacén interno de Variables cuando la Machine es válida, no encuentra ninguna `FORMULA` que la referencie y no hace nada más (sin excepción, sin log de error). Si la Machine no existe o está inactiva, no memoriza nada.

### Contrato de entrada/salida

Esta spec no añade ni modifica ningún endpoint REST ni evento WebSocket de `docs/11-api-rest.md`: reutiliza íntegramente `GET .../signals/:id/value`, `GET .../signals/:id/history` y el evento `SignalUpdated` ya catalogados, con su shape sin cambios. Los contratos internos nuevos viven en la capa Entities (código puro de dominio, sin I/O ni dependencias externas):

- Almacén interno del último valor de cada Variable cruda por Machine, keyed por `(machineId, variableName)`, paralelo a la Realtime Cache pero explícitamente no expuesto a REST/WebSocket/Alarmas: un detalle interno del Signal Engine. Instancia única compartida.
- Evaluador de fórmulas: parser aritmético mínimo propio (sin dependencia npm), que soporta `+ - * /`, paréntesis, negación unaria, literales numéricos y nombres de Variable; usado tanto para evaluar en tiempo de tick como para validar sintácticamente `expression` al crear/editar una Signal.
- Nueva función hermana de `resolveDirectSignalValue` (`backend/src/entities/signal-engine.ts`) que combina evaluación + regla de calidad (peor de las usadas) + timestamp (máximo), reutilizando el tipo `ResolvedSignalValue` ya existente (`backend/src/entities/signal-engine.ts:14-18`).
- Nuevo método de lookup inverso en `ISignalRepository` (`backend/src/use-cases/seed-demo-environment/ports/signal-repository.port.ts`), hermano de `findActiveDirectByMachineAndVariableName`: dado `(machineId, variableName)`, devuelve las Signals `FORMULA` activas de esa Machine cuya `signalSource.variables` incluye esa Variable.
- El evento publicado sigue siendo `SignalUpdated { signalId, machineId, companyId, value, quality, timestamp }`, idéntico para `DIRECT` y `FORMULA` (`backend/src/use-cases/dashboard/ingest-signal-tick.use-case.ts:87-94`).

### Criterios de aceptación backend

1. Un tick de una Variable referenciada por una Signal `FORMULA` activa, cuando todas las Variables de esa fórmula ya tienen un último valor conocido, evalúa la expresión, actualiza la Realtime Cache y publica `SignalUpdated` con el contrato idéntico al de una `DIRECT`.
2. El último valor de cada Variable cruda por Machine se memoriza en un almacén interno en cada tick de una Machine activa, incluso cuando esa Variable no tiene ninguna Signal `DIRECT`; ese almacén nunca es accesible vía REST, WebSocket ni Alarmas.
3. Si al llegar un tick alguna Variable referenciada por la fórmula aún no tiene valor conocido, el cálculo se omite (sin entrada en la Realtime Cache, sin `SignalUpdated`, sin valor por defecto); el cálculo se realiza en cuanto todas las Variables tengan al menos un valor.
4. El resultado de una `FORMULA` recibe la peor calidad de sus Variables usadas según el orden `GOOD < UNCERTAIN < BAD < OFFLINE`, y el timestamp más reciente entre ellas; si alguna Variable usada está `OFFLINE`, el resultado es `OFFLINE`.
5. Ante un error de cálculo (división por cero, Variable con valor no numérico, cualquier fallo aritmético) con valor válido previo, la Signal conserva su último `value`, pasa a calidad `BAD`, registra el error y no interrumpe el procesamiento del resto de Signals; ante el mismo error sin valor válido previo, la actualización se omite por completo.
6. La expresión se evalúa mediante un parser aritmético propio de la capa Entities; en ningún punto del código se usa `eval` ni `new Function` (OWASP A03), y no se añade ninguna dependencia npm de evaluación de expresiones.
7. Una Signal `FORMULA` con `historyEnabled: true` cuyo resultado es numérico persiste un punto en InfluxDB con el mismo guard y la misma tolerancia a fallos que una `DIRECT`; con `historyEnabled: false` no persiste nada.
8. La desconexión de una Machine marca `OFFLINE` a sus Signals `FORMULA` con entrada en la Realtime Cache, conservando último valor/timestamp, y el `AlarmEvaluationListener` evalúa las `AlarmDefinition` sobre Signals `FORMULA` — ambos sin ninguna modificación de su código.
9. Crear o editar una Signal `FORMULA` con `expression` no parseable, o que use en `expression` un nombre no declarado en `variables`, se rechaza con `422 FORMULA_EXPRESSION_INVALID`, adicional a la validación `422 FORMULA_REFERENCES_UNKNOWN_VARIABLE` ya existente.
10. Una Variable que ticka varias veces (o varias Variables de la misma fórmula) dentro de un ciclo del Simulador recalcula la `FORMULA` una vez por Variable cambiada, siempre con los últimos valores conocidos, sin exigir un lote atómico de Variables por tick.
11. Un tick para una Machine inexistente/inactiva no memoriza nada en el almacén interno de Variables; un tick de una Variable sin Signal `DIRECT` ni `FORMULA` asociada no produce ninguna actualización ni error.
12. Se corrigen las referencias obsoletas de `docs/specs/09-alarmas.md:24-25` de "spec tentativa 12" a "spec 13" y de "spec tentativa 13" a "spec 14", coherentes con `docs/specs/README.md:82-83`.
