# Spec: Pre-poblar histórico de una máquina demo

> Sin Frontend: es una funcionalidad de fundación, expuesta como endpoint/script de utilidad, sin pantalla propia. Ver [00-metodologia-y-calidad.md](../00-metodologia-y-calidad.md).

## Contexto

Los endpoints de históricos y agregaciones (Documento 4, InfluxDB) no tienen nada que consultar hasta que el Simulador lleve corriendo el tiempo suficiente. Esta spec genera retroactivamente histórico realista al provisionar una Machine demo, para poder probar gráficos y agregaciones desde el primer arranque (Documento 10, apartado 10.6).

## Actor(es)

Sistema, disparado por un `AdminCliente`/`SuperAdmin` al provisionar una Machine demo, o automáticamente al ejecutar el seed inicial del entorno.

## Precondiciones

- Se ha ejecutado la spec [fundacion-entorno-demo.md](fundacion-entorno-demo.md) (o una equivalente), de forma que ya existe al menos una Machine demo configurada.
- La Machine tiene `MachineConnection.ProviderType = Simulator` y sus Signals ya están configuradas (Documento 10, apartado 10.3).
- InfluxDB está disponible y accesible por el backend (Documento 4).

## Backend

### Flujo principal (Given/When/Then)

- **Given** una Machine demo recién creada, con Signals configuradas pero sin histórico.
- **When** se llama a `POST /api/v1/machines/:machineId/simulator/seed-history`.
- **Then** se generan, para cada Signal `DIRECT`, lecturas retroactivas cada 1 segundo cubriendo los últimos 7 días, aplicando el mismo algoritmo de random walk acotado que la generación en vivo (Documento 10, apartado 10.1), y se escriben en InfluxDB con sus timestamps correspondientes (Documento 4).
- **Then** al finalizar, una consulta de histórico de esa Signal con `resolution=hour` sobre los últimos 7 días devuelve datos agregados sin huecos.

### Casos borde / errores (Given/When/Then)

- **Given** una Machine que ya tiene histórico generado previamente (seed ya ejecutado).
- **When** se vuelve a llamar a `seed-history`.
- **Then** la API responde `409 CONFLICT` — no se duplica histórico sobre el mismo rango de fechas, salvo que se pase `force: true` explícitamente en el body.

- **Given** una Machine con `ProviderType = OpcUa`.
- **When** se llama a `seed-history`.
- **Then** la API responde `422 NOT_A_SIMULATED_MACHINE` (igual que en la spec `simulador-forzar-fallo`).

- **Given** InfluxDB no disponible en el momento de la llamada.
- **When** se ejecuta el seed.
- **Then** la operación falla de forma controlada (`500`), sin dejar histórico parcial inconsistente (todo o nada, transacción lógica de la operación de seed).

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), endpoint `POST /api/v1/machines/:machineId/simulator/seed-history`. Es una utilidad de desarrollo/demo, no forma parte del flujo de negocio habitual (Documento 10, apartado 10.6).

### Criterios de aceptación backend

1. Tras ejecutar el seed, existen lecturas en InfluxDB para cada Signal `DIRECT` de la Machine cubriendo los últimos 7 días a intervalos de 1 segundo.
2. Los valores generados respetan `min`/`max`/`stepMax` de cada Signal, igual que la generación en vivo.
3. Una consulta de histórico con cualquier `resolution` sobre ese rango no devuelve huecos.
4. El seed no se puede ejecutar dos veces sobre el mismo rango sin `force: true`.
5. El seed no se ejecuta sobre Machines con `ProviderType` distinto de `Simulator`.
