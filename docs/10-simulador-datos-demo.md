# 10. Simulador y Datos Demo

## Introducción

Este documento especifica el `SimulationProvider`: el Data Provider (Documento 2, apartado 2.4) que genera datos sin necesidad de un PLC ni de un servidor OPC UA real.

Es el mecanismo que permite desarrollar y probar todo el backend y el frontend —Signal Engine, Realtime Cache, Alarm Engine, History Service, Dashboard— antes de conectar hardware industrial real.

En la documentación previa a este documento, el Simulador se mencionaba únicamente como "una simple semilla de generación" (Documento 3, apartado 3.4). Este documento sustituye esa descripción por el diseño concreto.

---

## Objetivo

El `SimulationProvider` implementa el mismo contrato `IDataProvider` (Documento 2, apartado 2.4) que cualquier otro Data Provider:

```text
IDataProvider

connect()
disconnect()
subscribe()
unsubscribe()
isConnected()
```

Al resto de la plataforma —Signal Engine, Realtime Cache, Alarm Engine— le resulta indistinguible que los valores provengan del Simulador o de un servidor OPC UA real. Esto es lo que permite, más adelante, sustituir el proveedor de una Machine sin modificar nada más (Documento 1, "Objetivo de la arquitectura").

---

## 10.1 Algoritmo de generación

Cada señal simulada genera su valor mediante un **random walk acotado**: en cada tick, el nuevo valor varía suavemente respecto al anterior, dentro de un rango definido, en vez de saltar de forma brusca o puramente aleatoria.

```text
nuevoValor = clamp(valorAnterior + deltaAleatorio(-pasoMax, +pasoMax), min, max)
```

- `min` / `max`: rango válido de la señal.
- `pasoMax`: variación máxima permitida entre dos lecturas consecutivas.
- `deltaAleatorio`: valor aleatorio uniforme entre `-pasoMax` y `+pasoMax`.

Este algoritmo produce curvas con continuidad, similares al comportamiento real de un sensor, sin necesidad de modelar físicamente cada máquina.

### Frecuencia

Cada señal simulada se actualiza cada **1 segundo**. Es el mismo intervalo de actualización objetivo declarado para datos en tiempo real (Documento 2, "Objetivos Arquitectónicos").

---

## 10.2 Seeds por tipo de máquina

Cada Machine demo se provisiona con un conjunto fijo de Signals de ejemplo, según su tipo. Para una bobinadora de energía (Energy Winder), la seed inicial es:

| Signal | Unidad | Tipo | Rango (min–max) | Paso máx. por tick |
|---|---|---|---|---|
| Velocidad de bobinado | rpm | DIRECT | 0 – 1200 | 15 |
| Tensión de hilo | N | DIRECT | 0 – 50 | 1.5 |
| Temperatura de motor | °C | DIRECT | 20 – 90 | 0.5 |
| Corriente de motor | A | DIRECT | 0 – 25 | 1 |
| Contador de piezas | uds | DIRECT | 0 – ∞ (incremental) | +1 por ciclo, nunca decrece |
| Estado Run/Stop | booleano | DIRECT | true / false | cambia por evento, no por random walk |

Esta seed es un punto de partida razonable, pendiente de ajustar con los valores reales de las máquinas del cliente cuando estén disponibles. El mecanismo de generación (10.1) es independiente de qué señales concretas se definan.

`Contador de piezas` incrementa en cada ciclo de `Estado Run/Stop = true → false` en vez de aplicar random walk. `Estado Run/Stop` cambia de forma determinista cada cierto número de ticks configurable, no aleatoriamente, para simular ciclos de trabajo realistas.

---

## 10.3 Configuración vía `ConnectionConfig`

Para `ProviderType.Simulator` (Documento 3, apartado 3.2.4), `ConnectionConfig` contiene:

```json
{
  "seedProfile": "bobinadora-energia-v1",
  "signals": [
    { "variableName": "WindingSpeed", "min": 0, "max": 1200, "stepMax": 15 },
    { "variableName": "ThreadTension", "min": 0, "max": 50, "stepMax": 1.5 },
    { "variableName": "MotorTemperature", "min": 20, "max": 90, "stepMax": 0.5 },
    { "variableName": "MotorCurrent", "min": 0, "max": 25, "stepMax": 1 },
    { "variableName": "PieceCounter", "mode": "incremental" },
    { "variableName": "RunStop", "mode": "cycle", "cycleTicks": 300 }
  ]
}
```

Este esquema reemplaza la descripción anterior de doc 03 ("una simple semilla de generación") por una configuración concreta y editable por señal.

---

## 10.4 Aislamiento multi-tenant

Cada `Company` provisiona sus propias Machines demo, cada una con su propio `MachineConnection`/`ConnectionConfig`. No existe estado de simulación compartido entre Companies: dos Companies con máquinas demo del mismo tipo generan series de valores independientes, en cumplimiento del principio de aislamiento multiempresa (Documento 6, apartado 6.7).

---

## 10.5 Fallos controlables

Para poder probar el Alarm Engine (Documento 2, apartado 2.6) y la lógica de reconexión (Documento 2, "Reconexión Automática") sin esperar a hardware real, el `SimulationProvider` admite forzar, sobre una Machine demo concreta:

- **Desconexión**: `isConnected()` pasa a `false`; se dispara el mismo flujo de `MachineDisconnected` y reconexión automática que usaría un proveedor real.
- **Degradación de calidad**: una Signal concreta pasa a calidad `BAD` o `UNCERTAIN` (Documento 2, apartado 2.5) en las siguientes lecturas, sin dejar de generar valores.

Estas acciones se disparan mediante los endpoints de control del Simulador definidos en [11-api-rest.md](11-api-rest.md). Fuera de una intervención explícita, el Simulador siempre genera datos con calidad `GOOD` y conexión activa.

---

## 10.6 Histórico pre-poblado

Al provisionar una Machine demo, un script de seed genera retroactivamente **7 días** de histórico en InfluxDB, aplicando el mismo algoritmo de random walk acotado (10.1) con timestamps pasados a intervalos de 1 segundo.

Esto permite que los endpoints de históricos y agregaciones (Documento 4, apartado sobre InfluxDB) tengan datos que consultar desde el primer arranque de la plataforma, sin depender de dejar el Simulador corriendo varios días antes de poder probar gráficos o agregaciones por hora/día.

El script de seed es una utilidad de desarrollo, no un endpoint de la API pública.

---

## 10.7 Transición de Simulador a OPC UA real

Cuando el `ProviderType` de una Machine cambia de `Simulator` a `OpcUa`:

- El histórico ya generado en InfluxDB **no se purga ni se marca de forma distinta**: es histórico legítimo de esa Machine, generado en modo demo.
- A partir del cambio, los nuevos valores provienen del servidor OPC UA real, según el mapeo `NodeId → Signal` definido en `ConnectionConfig` (Documento 3, apartado 3.2.4, sección OPC UA).
- Las Signals, AlarmDefinitions y Dashboards configurados no cambian: siguen referenciando las mismas Signals por nombre de Variable, tal como garantiza el desacoplamiento de Documento 1 y Documento 2.

No existe (ni se requiere en esta fase) un "modo mixto" formal dentro de una misma Machine: una Machine usa un único `ProviderType` a la vez. Sí pueden convivir, dentro de una misma Company, Machines en modo `Simulator` y Machines en modo `OpcUa` simultáneamente, dado que el proveedor se define por Machine (Documento 2, "Modelo de Funcionamiento").

---

## Decisión Arquitectónica

El Simulador se implementa como un Data Provider más, sujeto al mismo contrato `IDataProvider` que un proveedor real. Esto evita cualquier rama de código especial para "modo demo" en el Signal Engine, la Realtime Cache o el Alarm Engine: esos componentes nunca saben si están recibiendo datos simulados o reales, igual que nunca saben si el proveedor habla OPC UA, MQTT o Modbus.

La capacidad de forzar fallos de conexión/calidad se implementa dentro del propio `SimulationProvider`, no como lógica adicional en el dominio, manteniendo la regla de que el dominio nunca conoce el origen concreto de los datos.
