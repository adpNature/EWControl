# Spec: Conexión OPC UA estable (sesiones, suscripciones y reconexión)

> Sin frontend: cambia cómo el Backend se conecta al PLC, no lo que ve el usuario.

## Contexto

El 13/11/2026 el runtime de CODESYS del PLC piloto (Inovance, `opc.tcp://192.168.1.1:4840`) dejó de aceptar conexiones (`ECONNREFUSED`). Ya había pasado otras veces, siempre entre 1 y 1,5 h después de que el Backend se conectara. Los logs del Backend muestran el patrón:

1. **11:41–11:42**: muchas conexiones seguidas del explorador ([18-integracion-opc-ua.md](18-integracion-opc-ua.md)) y de la sincronización ([21-sincronizacion-variables-opc-ua.md](21-sincronizacion-variables-opc-ua.md)). Cada operación abre su propio cliente y su propia sesión.
2. **11:43:00**: la conexión del `OpcUaProvider` se reestablece. Desde ahí, el PLC le corta el socket cada vez antes de 20 s: «socket has been disconnected by third party». El _keep alive_ de node-opcua lo detecta (comprueba cada 20 s) y fuerza una reconexión.
3. En cada reconexión se abren un canal y una sesión nuevos y se vuelven a crear **450 MonitoredItems con una petición por variable**. La sesión anterior sigue viva en el PLC hasta que caduca (60 s).
4. **151 reconexiones** después (unos 66 min), el runtime se cae.

Causas encontradas en el código:

- **Sesiones huérfanas en el explorador**: si una operación supera su tiempo límite, el cliente se desconecta **sin cerrar la sesión**, y esta queda ocupando sitio en el PLC durante 60 s. En este PLC el explorador tarda más de 12 s, así que pasa a menudo.
- **Sin límite de concurrencia**: cada exploración, sincronización o prueba abre una conexión en paralelo con las demás y con la del provider.
- **Una petición por variable**: `ClientMonitoredItem.create` dentro de un bucle envía 450 `CreateMonitoredItems` seguidos al conectar y otra vez en cada reconexión.
- **Se suscribe todo el mapeo** (450 variables), aunque las Signals solo usan unas pocas.
- **Reconexión sin freno**: si el PLC corta la conexión una y otra vez, el Backend reintenta cada 20 s indefinidamente.

La hipótesis más probable es que el servidor de CODESYS se queda sin sesiones o canales libres, expulsa conexiones y, con la carga sostenida, acaba cayéndose. Esta spec reduce la carga y acota el comportamiento del Backend sea cual sea la causa exacta. La validación final contra el PLC real se hace cuando vuelva a estar disponible.

## Actor(es)

Sistema (`OpcUaProviderRegistry`, `OpcUaProvider`, `NodeOpcUaDriver`, `NodeOpcUaExplorer`).

## Precondiciones

Una Machine activa con conexión `OpcUa`.

## Backend

### Flujo principal (Given/When/Then)

**Solo se suscriben las variables que usan las Signals**

- **Given** una Machine con 450 variables en el `nodeMapping` y Signals activas que usan 5 de ellas (DIRECT `variableName` o FORMULA `variables`).
- **When** el `OpcUaProviderRegistry` arranca su provider.
- **Then** la Subscription monitoriza **solo esas 5** variables. El resto del mapeo sigue disponible para escribir (paquetes, spec 20), para la sincronización y para las categorías, pero no se lee en tiempo real.
- **When** se crea, edita o borra una Signal (`MachineSignalsChanged`).
- **Then**:
  - se recalcula el conjunto;
  - se añaden los MonitoredItems nuevos y se quitan los que sobran, **en la misma sesión**, sin reconectar;
  - los valores ya recibidos se republican, como hasta ahora.
- Una Machine sin Signals que usen variables mantiene la sesión abierta (para poder escribir), con la Subscription vacía.

**MonitoredItems por lotes**

- **When** hay que crear N MonitoredItems.
- **Then** se envían en lotes de **como mucho 100 por petición** `CreateMonitoredItems`, no una petición por variable. Un ítem rechazado por el servidor (`BadNodeIdUnknown`…) se notifica como hasta ahora (`onMonitoredItemRejected`) sin afectar al resto.

**Freno de reconexiones**

- **Given** una conexión que se pierde (`connection_lost`) **3 veces en 5 minutos**.
- **Then** el driver:
  - deja de reconectar automáticamente;
  - **cierra de forma explícita** la Subscription (`DeleteSubscriptions`) y la sesión (`CloseSession`), cada cierre con un tiempo límite;
  - desconecta el cliente;
  - registra un `WARN` con el número de cortes y la espera;
  - espera una **pausa creciente** antes de volver a conectar desde cero: 1 min, 2 min, 4 min… hasta **15 min** como máximo.
- Si después de reconectar la conexión se mantiene **10 minutos** sin cortes, la pausa vuelve a empezar desde 1 min.
- Durante la pausa la Machine figura como desconectada (`MachineDisconnected`, Signals `OFFLINE`), igual que sin conexión.

**Cierre limpio de sesiones del explorador**

- **Given** una operación del explorador o de la sincronización (`test`, `browse`, `sync`).
- **When** termina, falla o supera su tiempo límite.
- **Then** siempre se intenta `CloseSession` (como mucho 2 s) **antes** de desconectar el cliente. Si la operación sigue en curso al vencer el tiempo límite, se cierra la sesión igualmente.
- Las sesiones del explorador piden `requestedSessionTimeout` de 30 s (antes, 60 s): si una se queda huérfana, el PLC la libera antes.

**Una operación del explorador a la vez por endpoint**

- **Given** dos operaciones del explorador sobre el mismo endpoint a la vez (por ejemplo, desplegar dos carpetas del árbol).
- **Then** se ejecutan **una detrás de otra**, nunca en paralelo. El tiempo límite de cada una cuenta desde que empieza a esperar su turno. Operaciones sobre endpoints distintos no se esperan entre sí.

### Casos borde / errores (Given/When/Then)

- **Fallo al cerrar**: si `DeleteSubscriptions` o `CloseSession` fallan o vencen su tiempo límite, se ignora y se desconecta igualmente. Nunca se bloquea el `stop()` más de 5 s.
- **`stop()` durante la pausa**: cancela la espera y no vuelve a conectar.
- **Signal que usa una variable que no está en el mapeo**: se ignora al calcular el conjunto (no hay NodeId que suscribir), como hasta ahora.
- **Cambio de Signals sin conexión**: se guarda el conjunto nuevo y se aplica al conectar.
- **Fallo al añadir o quitar ítems en caliente**: se registra un `WARN` y se reintenta en la siguiente conexión. No fuerza una reconexión.

### Contrato de entrada/salida

Sin cambios en la API REST ni en los eventos. El conjunto de variables suscritas deja de ser todo el `nodeMapping` (documentado en [18-integracion-opc-ua.md](18-integracion-opc-ua.md)).

### Criterios de aceptación backend

1. El provider solo monitoriza los NodeIds del mapeo que usan Signals activas de la Machine (DIRECT y FORMULA).
2. `MachineSignalsChanged` añade y quita MonitoredItems en la sesión existente, sin reconectar ni emitir `MachineDisconnected`.
3. Los MonitoredItems se crean en lotes de como mucho 100 por petición. Un ítem rechazado no afecta al resto.
4. Con 3 cortes en 5 minutos, el driver cierra Subscription y sesión, desconecta y espera 1, 2, 4… hasta 15 min antes de reconectar desde cero. 10 min sin cortes reinician la pausa.
5. `stop()` cierra Subscription y sesión antes de desconectar, cancela cualquier espera y termina en 5 s como mucho.
6. El explorador cierra siempre la sesión antes de desconectar, también al vencer el tiempo límite, y pide 30 s de `requestedSessionTimeout`.
7. Las operaciones del explorador sobre un mismo endpoint se ejecutan de una en una.
8. Cobertura ≥ 80 % en Entities y Use Cases. La política de reconexión es una clase pura con reloj inyectado, con tests unitarios.
9. Integración contra el servidor OPC UA de desarrollo:
   - con 450 variables en el mapeo y 3 usadas por Signals, se monitorizan 3;
   - al crear otra Signal se monitorizan 4 sin reconectar.

### Validación en planta (manual, cuando el PLC esté disponible)

1. Reiniciar el runtime de CODESYS.
2. Levantar el Backend y comprobar en los logs que no aparecen «Keep alive has failed» ni «socket has been disconnected» durante al menos 2 horas.
3. Si el PLC vuelve a cortar, comprobar que el Backend entra en pausa tras 3 cortes y que el runtime sigue vivo.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

- **A04 (diseño inseguro / disponibilidad)**: el Backend deja de poder saturar el PLC. Las reconexiones quedan acotadas, la concurrencia del explorador se limita y las sesiones se liberan.
- Sin cambios de autenticación, autorización ni superficie de entrada.

## Fuera de alcance

- Compartir una única sesión entre el provider y el explorador.
- Exponer el estado «en pausa» en la API o en la interfaz (de momento solo logs y métricas existentes).
- Cambiar el intervalo de muestreo o configurar por Machine los parámetros de la pausa.
