# Spec: Forzar fallo en una máquina demo (desconexión / calidad degradada)

> Sin Frontend: es una funcionalidad de fundación, expuesta como endpoints de control para pruebas, sin pantalla propia. Ver [00-metodologia-y-calidad.md](../00-metodologia-y-calidad.md).

## Contexto

Sin hardware real, el Alarm Engine (Documento 2, apartado 2.6) y la lógica de reconexión automática (Documento 2, "Reconexión Automática") no se pueden probar de forma natural. Esta spec permite forzar, sobre una Machine demo, una desconexión o una degradación de calidad, para validar esos flujos (Documento 10, apartado 10.5).

## Actor(es)

`AdminCliente` o `SuperAdmin` de la Company propietaria de la Machine (vía API, normalmente desde herramientas de prueba, no desde el Dashboard final).

## Precondiciones

- Se ha ejecutado la spec [01-fundacion-entorno-demo.md](01-fundacion-entorno-demo.md) (o una equivalente), de forma que ya existe al menos una Machine demo configurada.
- La Machine tiene `MachineConnection.ProviderType = Simulator`.
- El usuario autenticado tiene acceso a esa Machine (misma Company, o `SuperAdmin`).

## Backend

### Flujo principal (Given/When/Then)

- **Given** una Machine en modo `Simulator`, conectada.
- **When** se llama a `POST /api/v1/machines/:machineId/simulator/force-disconnect`.
- **Then** el `SimulationProvider` de esa Machine pasa a `isConnected() = false`, se publica el evento `MachineDisconnected` (Documento 2), y deja de generar lecturas hasta que se revierta.

- **Given** una Machine desconectada forzadamente.
- **When** se llama a `POST /api/v1/machines/:machineId/simulator/reconnect`.
- **Then** el `SimulationProvider` vuelve a `isConnected() = true`, se publica `MachineConnected`, y retoma la generación de lecturas desde el último valor conocido de cada Signal.

- **Given** una Signal `MotorTemperature` con calidad `GOOD`.
- **When** se llama a `POST /api/v1/machines/:machineId/simulator/force-quality` con `{ "signalId": "...", "quality": "BAD", "durationTicks": 10 }`.
- **Then** las siguientes 10 lecturas de esa Signal se publican con calidad `BAD` (el valor numérico se sigue generando, solo cambia la calidad), y a partir de la lectura 11 vuelve a `GOOD` automáticamente.

### Casos borde / errores (Given/When/Then)

- **Given** una Machine con `ProviderType = OpcUa` (no es una Machine demo).
- **When** se llama a cualquier endpoint `/simulator/*` sobre esa Machine.
- **Then** la API responde `422` con `code: "NOT_A_SIMULATED_MACHINE"`.

- **Given** una Machine ya desconectada forzadamente.
- **When** se llama de nuevo a `force-disconnect`.
- **Then** la operación es idempotente: responde `200` sin duplicar el evento `MachineDisconnected`.

- **Given** un `signalId` que no pertenece a la Machine indicada.
- **When** se llama a `force-quality`.
- **Then** la API responde `404`.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección "Endpoints de control del Simulador".

### Criterios de aceptación backend

1. `force-disconnect` deja la Machine sin generar lecturas y publica `MachineDisconnected` una sola vez.
2. `reconnect` retoma la generación de lecturas y publica `MachineConnected`.
3. `force-quality` degrada exactamente `durationTicks` lecturas y luego vuelve a `GOOD` sin intervención manual.
4. Ningún endpoint `/simulator/*` funciona sobre una Machine con `ProviderType` distinto de `Simulator`.
5. El Alarm Engine reacciona igual ante una desconexión forzada que ante una desconexión real (mismo evento `MachineDisconnected`).
