# Spec: Generar lectura simulada de una Signal

> Sin Frontend: es una funcionalidad de fundación, sin interfaz propia. Ver [00-metodologia-y-calidad.md](../00-metodologia-y-calidad.md).

## Contexto

El `SimulationProvider` (Documento 10, apartado 10.1) necesita generar, cada segundo, un nuevo valor para cada Signal de tipo `DIRECT` de una Machine con `ProviderType = Simulator`, siguiendo el algoritmo de random walk acotado. Es el requisito base para poder desarrollar y probar el resto del pipeline (Signal Engine, Realtime Cache, Alarm Engine, History Service, Documento 2) sin hardware real.

## Actor(es)

Sistema (proceso interno del `SimulationProvider`, sin intervención de usuario).

## Precondiciones

- Se ha ejecutado la spec [01-fundacion-entorno-demo.md](01-fundacion-entorno-demo.md) (o una equivalente), de forma que ya existe al menos una Machine demo configurada.
- Existe una Machine con `MachineConnection.ProviderType = Simulator`.
- La Machine tiene al menos una Signal configurada con parámetros de generación (`min`, `max`, `stepMax`) en su `ConnectionConfig` (Documento 10, apartado 10.3).
- El `SimulationProvider` de esa Machine está `connected` (`isConnected() = true`).

## Backend

### Flujo principal (Given/When/Then)

- **Given** una Machine en modo `Simulator` conectada, con una Signal `WindingSpeed` (`min=0`, `max=1200`, `stepMax=15`) y último valor conocido `600`.
- **When** transcurre 1 segundo (tick del generador).
- **Then** se genera un nuevo valor `v` tal que `v = clamp(600 + delta, 0, 1200)` con `delta` uniforme en `[-15, 15]`, y ese valor se publica como Variable (Documento 2, apartado 2.4, "Variables Publicadas") hacia el Signal Engine, con calidad `GOOD` y timestamp actual.

- **Given** es la primera lectura de una Signal recién provisionada (no existe "último valor conocido").
- **When** se genera la primera lectura.
- **Then** el valor inicial se toma como el punto medio del rango (`(min + max) / 2`), y a partir de ahí se aplica random walk normalmente.

### Casos borde / errores (Given/When/Then)

- **Given** el valor actual está en el límite superior del rango (`valorActual = max`).
- **When** el delta aleatorio es positivo.
- **Then** el nuevo valor se recorta a `max` (no lo supera).

- **Given** una Signal configurada con `mode: "incremental"` (ej. `PieceCounter`, Documento 10 apartado 10.2).
- **When** se genera un tick.
- **Then** no se aplica random walk: el valor solo se incrementa cuando corresponde según su propia regla (ver spec de ciclo Run/Stop, evolución futura), nunca decrece.

- **Given** una Signal configurada con `mode: "cycle"` (ej. `RunStop`).
- **When** se genera un tick.
- **Then** el valor booleano solo cambia cada `cycleTicks` ticks, no en cada tick.

- **Given** el `SimulationProvider` de la Machine no está conectado (desconexión forzada, ver spec `03-simulador-forzar-fallo`).
- **When** transcurre un tick.
- **Then** no se genera ninguna lectura para esa Machine hasta que se reconecte.

### Contrato de entrada/salida

No es un endpoint HTTP: es un proceso interno programado (scheduler) por Machine activa en modo `Simulator`. La salida es una Variable publicada internamente al Signal Engine (Documento 2, apartado 2.4), con el mismo formato que cualquier otro Data Provider.

### Criterios de aceptación backend

1. Cada Signal `DIRECT` de tipo numérico con `min`/`max`/`stepMax` genera un nuevo valor cada 1 segundo mientras la Machine esté conectada en modo `Simulator`.
2. El valor generado nunca sale del rango `[min, max]`.
3. La diferencia entre dos lecturas consecutivas nunca supera `stepMax`.
4. Las Signals con `mode: "incremental"` nunca decrecen.
5. Las Signals con `mode: "cycle"` solo cambian de valor cada `cycleTicks` ticks.
6. Ninguna lectura se genera para una Machine desconectada.
7. Todas las lecturas se publican con calidad `GOOD`, salvo degradación forzada activa (ver spec `03-simulador-forzar-fallo`).
