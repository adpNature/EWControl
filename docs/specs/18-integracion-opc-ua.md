# Spec: Integración OPC UA real (Data Provider `OpcUa`)

## Contexto

Es la Fase 12 del roadmap ([README](../../README.md#roadmap)). Hasta hoy el único `ProviderType` con implementación es `Simulator`: `ConnectionConfig` solo modela la forma del Simulador (`backend/src/entities/connection-config.vo.ts`) y `PUT /machines/:machineId/connection` rechaza cualquier otro proveedor con `422 PROVIDER_NOT_SUPPORTED` ([06-gestion-machines-signals.md](06-gestion-machines-signals.md), criterio backend 4).

La arquitectura ya describe el `OpcUaProvider`:

- [02-arquitectura.md](../02-arquitectura.md), apartado "Data Provider": un provider por Machine, que usa **Subscriptions** en lugar de polling. La reconexión automática es responsabilidad exclusiva del Data Provider.
- [03-modelo-de-datos.md](../03-modelo-de-datos.md), apartado 3.2.4: la forma de `ConnectionConfig` para `OpcUa` (`endpointUrl`, seguridad, `nodeMapping`) y la tabla `StatusCode → calidad interna`.
- [10-simulador-datos-demo.md](../10-simulador-datos-demo.md), apartado 10.7: pasar una Machine de `Simulator` a `OpcUa` conserva su histórico, sus Signals, sus Alarmas y sus Dashboards.

**Modalidades de despliegue.** EWControl tendrá dos:

- **Local**: el stack completo corre en un PC de la planta conectado por cable a la máquina.
- **Remota**: un backend en la nube que recibe los datos de la planta.

Esta spec cubre **la modalidad local**. El `OpcUaProvider` se ejecuta dentro del Backend, como prevé [05-despliegue-infraestructura.md](../05-despliegue-infraestructura.md) §5.4 ("en la primera versión, los Data Providers se ejecutan junto al Backend"). El `endpointUrl` es configuración por Machine guardada en BD, no código. En la planta, el PC se conecta por cable a la máquina, cuyo servidor OPC UA escucha en `opc.tcp://192.168.1.1:4840`. Esa dirección **solo es alcanzable desde el PC de planta**, así que el stack tiene que ejecutarse allí. El equipo accede a ese PC por escritorio remoto para desplegar y probar. La modalidad remota (edge → nube, mTLS, buffer local, [06-seguridad-global.md](../06-seguridad-global.md) §6.3) queda para una spec futura.

**Alcance de seguridad del canal OPC UA.** Esta spec solo soporta `securityMode: None`, `securityPolicy: None` y `authMode: Anonymous`, que es lo que expone la máquina actual. La forma de `ConnectionConfig` queda preparada para añadir `UserName` y `Certificate` en una spec posterior, pero hoy cualquier otro valor se rechaza.

**Descubrimiento de nodos.** Los `NodeId` de la máquina no se conocen de antemano, así que la spec incluye **explorar el espacio de direcciones** del servidor OPC UA desde la UI para elegir los nodos y mapearlos a variables.

**Qué expone la máquina** (volcado de solo lectura del 2026-10-30, a través del túnel):

- PLC Siemens S7-1500 (CPU 1514SP TF-2 PN, firmware V04.01.02) con su servidor OPC UA integrado.
- Endpoints: `None`/`None` con `Anonymous`, y `SignAndEncrypt`/`Basic256Sha256` también con `Anonymous`.
- Namespaces:
  - `ns=1`: `urn:SIMATIC:PLC_1`
  - `ns=2`: `http://opcfoundation.org/UA/DI/`
  - `ns=3`: `http://www.siemens.com/simatic-s7-opcua`. Aquí están las variables del programa.
- Las variables cuelgan de `Objects/DeviceSet/PLC_1/DataBlocksGlobal/<DB>`. Sus NodeIds son strings con comillas al estilo TIA Portal, por ejemplo `ns=3;s="Lectura"."REAL_1"` o `ns=3;s="Lectura"."ARRAY_1"[0]."Ancho"`.
- Tipos escalares encontrados: `Boolean`, `Int16`, `Int32`, `Float`, `Double`, `Byte`, `UInt16` y `UInt32`.
- Los arrays y los structs aparecen como `Variable` con `ExtensionObject`, y debajo cuelgan como nodos hijos sus miembros escalares, que sí se pueden mapear uno a uno.
- **El reloj del PLC está desfasado**: el servidor informa de 2012-01-08 cuando la fecha real es 2026-10-30. Sus `sourceTimestamp`/`serverTimestamp` no son fiables (ver "Lectura en tiempo real").

**Pruebas contra la máquina real desde desarrollo.** Mientras dure el desarrollo, se puede llegar a la máquina desde un equipo de desarrollo con un **túnel de puertos temporal a través del PC de planta**: para el piloto se usa Tailscale, con el PC de planta como _subnet router_ que anuncia solo `192.168.1.1/32`. El equipo de desarrollo llega directamente a `opc.tcp://192.168.1.1:4840`, igual que el PC de planta, así que la config de la Machine es la misma en el piloto y en el despliegue final. Si se usara un reenvío de puertos a `localhost`, por ejemplo con el túnel TCP de AnyDesk, el servidor seguiría anunciando `192.168.1.1`, y de ahí `endpointMustExist: false` (ver casos borde). El túnel no forma parte del producto: es una herramienta de desarrollo y se cierra cuando no se usa, porque el servidor de la máquina acepta conexiones anónimas.

**Desarrollo sin acceso a la máquina.** Cuando no hay túnel, como en CI o con el PC de planta apagado, no hay ruta hasta la máquina real. Por eso la spec incluye un **servidor OPC UA de desarrollo** (`pnpm run opcua:dev-server` en `/backend`), un servidor `node-opcua` local que **imita el espacio de direcciones del PLC real**. Usa los mismos namespace URIs y el mismo índice `ns=3`, la ruta `DeviceSet/PLC_1/DataBlocksGlobal/Lectura` y los mismos NodeIds (`"Lectura"."BOOL_1"`, `"INT_1"`, `"DINT_1"`, `"REAL_1"`, `"LREAL_1"` y `"ARRAY_1"[i]."Ancho"/"Alto"/"Profundo"`), con valores que cambian periódicamente. Un mapeo hecho contra el servidor de desarrollo sirve tal cual contra la máquina. El backend del `docker compose` de desarrollo se conecta a él igual que se conectaría a la máquina. El mismo espacio de direcciones lo usa el test de integración. La validación contra la máquina real se hace en el PC de planta, ya desplegado.

## Actor(es)

- `User` con rol `AdminCliente` (solo Machines de su Company) o `SuperAdmin` (cualquier Company): configura la conexión, prueba el endpoint y explora los nodos.
- **Sistema** (`OpcUaProviderRegistry`): mantiene la sesión OPC UA de cada Machine `OpcUa`, recibe las notificaciones de la Subscription y gestiona la reconexión.

## Precondiciones

- El usuario está autenticado ([05-auth-login.md](05-auth-login.md)) y la Machine existe, está activa y pertenece a una Company a la que tiene acceso.
- El host donde corre el Backend (y su contenedor) tiene ruta de red hasta el servidor OPC UA, es decir, el PC de planta conectado por cable a la máquina, o el servidor OPC UA de desarrollo en local.

## Backend

### Flujo principal (Given/When/Then)

**Configuración**

- **Given** una Machine con `providerType: "Simulator"`.
- **When** un `AdminCliente` llama a `PUT /api/v1/machines/:machineId/connection` con:
  ```json
  {
    "providerType": "OpcUa",
    "connectionConfig": {
      "endpointUrl": "opc.tcp://192.168.1.1:4840",
      "securityMode": "None",
      "securityPolicy": "None",
      "authMode": "Anonymous",
      "timeoutMs": 5000,
      "samplingIntervalMs": 1000,
      "nodeMapping": [
        { "nodeId": "ns=2;s=Line1.WindingSpeed", "signalVariableName": "WindingSpeed" }
      ]
    }
  }
  ```
- **Then**:
  - La API responde `200` con la `MachineConnection` reemplazada.
  - Se publica el evento interno `MachineConnectionReplaced { machineId, previousProviderType, providerType }`.
  - El `SimulationProvider` de esa Machine se detiene y arranca un `OpcUaProvider` con la nueva config, **sin reiniciar la aplicación**.

- **Given** una Machine `OpcUa`.
- **When** se vuelve a llamar a `PUT .../connection` con una config `OpcUa` distinta (otro endpoint, otro mapeo) o con `providerType: "Simulator"`.
- **Then** el provider en ejecución se detiene: se cierra la sesión y la Subscription. Después arranca el que corresponde a la nueva config.

**Prueba de conexión y exploración**

- **Given** un `AdminCliente` configurando una Machine.
- **When** llama a `POST /api/v1/machines/:machineId/connection/opcua/test` con `{ "endpointUrl": "opc.tcp://192.168.1.1:4840" }`.
- **Then** el Backend abre una sesión anónima efímera y la cierra, y responde `200 { "reachable": true }`. Si no puede conectar, responde `200 { "reachable": false, "reason": "<motivo genérico>" }` (ver casos borde).

- **Given** un endpoint alcanzable.
- **When** llama a `POST /api/v1/machines/:machineId/connection/opcua/browse` con `{ "endpointUrl": "...", "nodeId": "ns=2;s=Line1" }`. Si se omite `nodeId`, se parte de `ObjectsFolder`, `i=85`.
- **Then** la API responde `200` con los hijos directos del nodo (exploración por niveles, bajo demanda):
  ```json
  {
    "nodes": [
      {
        "nodeId": "ns=2;s=Line1.WindingSpeed",
        "browseName": "WindingSpeed",
        "displayName": "Winding Speed",
        "nodeClass": "Variable",
        "dataType": "Double",
        "hasChildren": false
      }
    ]
  }
  ```

**Lectura en tiempo real**

- **Given** una Machine `OpcUa` cuyo endpoint es alcanzable.
- **When** el `OpcUaProvider` arranca, ya sea al iniciar la aplicación o tras un `PUT .../connection`.
- **Then**:
  - Conecta y crea **una Subscription** con un MonitoredItem por cada entrada de `nodeMapping`, usando el `samplingIntervalMs` configurado.
  - Publica `MachineConnected` y pone a `1` la métrica `ewcontrol_data_provider_connected{machineId}`.
- **And** cada notificación de cambio de valor se traduce a una `Variable`:
  - `name` es el `signalVariableName` mapeado.
  - `value` y `type` se derivan del `Variant`.
  - `quality` sale de la tabla de 03-modelo-de-datos.md: `Good*`→`GOOD`, `Uncertain*`→`UNCERTAIN`, `Bad*`→`BAD`.
  - `timestamp` es la **hora de recepción según el reloj del Backend** (puerto `CLOCK`), no el `sourceTimestamp` del PLC. El reloj del PLC piloto va 14 años por detrás, y usar sus timestamps escribiría el histórico de InfluxDB en 2012. Al ser una Subscription, el retardo entre muestreo y recepción es del orden del `publishingInterval`, despreciable para el histórico.
  - Lleva un `correlationId` nuevo.
- **And** la `Variable` entra en `IngestSignalTickUseCase` exactamente igual que una del Simulador. Realtime Cache, WebSocket, InfluxDB y Alarm Engine no cambian.

**Reconexión**

- **Given** una Machine `OpcUa` conectada.
- **When** se pierde la conexión: el servidor OPC UA se reinicia, la máquina se apaga o se desconecta el cable.
- **Then**:
  - El provider publica `MachineDisconnected`, cuyo listener existente pone las Signals de la Machine en `OFFLINE`.
  - La métrica de conexión pasa a `0`.
  - El provider reintenta indefinidamente con backoff exponencial, con un máximo de 30 s entre intentos.
- **And** al restablecerse la conexión:
  - Recupera (o recrea) la Subscription.
  - Publica `MachineConnected` e incrementa `ewcontrol_data_provider_reconnects_total{machineId}`.
  - Los valores vuelven a fluir sin intervención manual.

### Casos borde / errores (Given/When/Then)

- **Given** un `PUT .../connection` `OpcUa` con:
  - un `endpointUrl` cuyo esquema no es `opc.tcp://`,
  - `securityMode`/`securityPolicy` distinto de `None` o `authMode` distinto de `Anonymous`,
  - `nodeMapping` vacío,
  - un `nodeId`/`signalVariableName` repetido,
  - o un `signalVariableName` que no cumple `[A-Za-z_][A-Za-z0-9_]*`, el patrón de identificador del motor de fórmulas (`formula-evaluator.ts`). Si no lo cumpliera, la variable no se podría referenciar desde una Signal `FORMULA`.
- **When** se procesa la petición.
- **Then** la API responde `400 INVALID_CONNECTION_CONFIG` sin modificar la conexión existente. El `ReplaceMachineConnectionDto` no puede validar la forma de `connectionConfig` porque depende de `providerType`: la valida el use-case con `parseOpcUaConnectionConfig` (`backend/src/entities/connection-config.vo.ts`), que también rechaza cualquier campo no declarado.

- **Given** un `PUT .../connection` con `providerType` `Mqtt` o `ModbusTcp`.
- **When** se procesa.
- **Then** la API sigue respondiendo `422 PROVIDER_NOT_SUPPORTED`.

- **Given** la variable de entorno `OPCUA_ALLOWED_HOSTS` definida (lista de hosts y/o CIDR, p. ej. `192.168.1.0/24,10.0.0.5`).
- **When** se hace un `PUT .../connection`, un `test` o un `browse` contra un `endpointUrl` cuyo host no está en la lista.
- **Then** la API responde `422 OPCUA_ENDPOINT_NOT_ALLOWED` y el Backend no abre ninguna conexión. Así se mitiga el SSRF (OWASP A10): el Backend nunca abre sockets hacia destinos arbitrarios que elija un cliente.
- **And** si `OPCUA_ALLOWED_HOSTS` está vacía o no existe, se permite cualquier host con esquema `opc.tcp://`. Es el caso por defecto en la modalidad local, donde el Backend vive en la red de planta.

- **Given** un endpoint inalcanzable o que no responde dentro de `timeoutMs` (por defecto 5000 ms).
- **When** se hace un `test` o un `browse`.
- **Then**:
  - `test` responde `200 { "reachable": false, "reason": "UNREACHABLE" | "TIMEOUT" | "SECURITY_REJECTED" }`.
  - `browse` responde `502 OPCUA_ENDPOINT_UNREACHABLE`.
  - El detalle técnico del error (stack, mensajes de node-opcua) solo va al log, nunca a la respuesta (OWASP A05).

- **Given** un `browse` con un `nodeId` sintácticamente inválido o inexistente en el servidor.
- **When** se procesa.
- **Then** la API responde `400 OPCUA_INVALID_NODE_ID`, o `200 { "nodes": [] }` si el nodo existe pero no tiene hijos.

- **Given** un `endpointUrl` sin el esquema `opc.tcp://` en `test` o `browse`.
- **When** se procesa la petición.
- **Then** la API responde `400 INVALID_ENDPOINT_URL` sin abrir ninguna conexión.

- **Given** un servidor OPC UA que anuncia en `GetEndpoints` un hostname distinto del que usa el cliente (típico cuando el PLC anuncia su nombre de máquina, o detrás de NAT, o desde un contenedor Docker).
- **When** el provider o el explorador conectan.
- **Then** se usa siempre el host del `endpointUrl` configurado, no el anunciado por el servidor (`endpointMustExist: false`).

- **Given** una Machine `OpcUa` cuyo endpoint es inalcanzable **al arrancar la aplicación**.
- **When** arranca el Backend.
- **Then** el arranque **no falla ni se bloquea**: esa Machine queda `OFFLINE` reintentando en segundo plano y el resto de Machines funciona con normalidad.

- **Given** un `nodeId` del `nodeMapping` que el servidor rechaza al crear el MonitoredItem (`BadNodeIdUnknown`, etc.).
- **When** se crea la Subscription.
- **Then** se registra un warning con el `nodeId` y el motivo, y el resto de MonitoredItems sigue funcionando. Esa variable no publica nada: no hay valor que publicar y el Signal Engine no admite Variables sin valor (no se inventan valores, que acabarían en el histórico).

- **Given** una notificación con calidad `Bad` o `Uncertain` que no trae valor (p. ej. `BadNoCommunication`).
- **When** llega al provider.
- **Then** se republica el último valor conocido de esa variable con la calidad recibida; si nunca tuvo valor, no se publica nada.

- **Given** un servidor OPC UA cuyo reloj difiere más de 5 minutos del reloj del Backend, como el PLC piloto.
- **When** el provider conecta.
- **Then** se registra **un único** warning por conexión con el desfase detectado, y los valores siguen fluyendo con el `timestamp` de recepción del Backend.

- **Given** una notificación cuyo `Variant` no es numérico, booleano ni string (p. ej. un array o un ExtensionObject).
- **When** llega al provider.
- **Then** se descarta con un warning en el log y no se publica ninguna `Variable`.

- **Given** una Machine `OpcUa` conectada cuyo PLC no cambia de valor (OPC UA solo notifica cambios).
- **When** se crea o edita una Signal de esa Machine después de que la Subscription recibiera los valores iniciales.
- **Then** se publica el evento interno `MachineSignalsChanged` y el provider republica el último valor conocido de cada variable, con la hora actual. Así la Signal nueva tiene valor de inmediato, sin esperar a que el PLC cambie. No se hace polling del PLC: se reutiliza el último valor recibido.

- **Given** una Machine `OpcUa`.
- **When** se llama a cualquier endpoint de `simulator-control` (forzar desconexión o calidad).
- **Then** la API sigue respondiendo como hoy para una Machine que no es del Simulador, sin cambios de comportamiento.

- **Given** una Machine `OpcUa` que se da de baja (`DELETE /machines/:id`).
- **When** se completa la baja.
- **Then** se publica el evento interno `MachineDeactivated` y el registry detiene su provider y cierra la sesión.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección "MachineConnection":

- `PUT /api/v1/machines/:machineId/connection` admite `providerType: "OpcUa"` con la forma de `ConnectionConfig` de [03-modelo-de-datos.md](../03-modelo-de-datos.md) 3.2.4. El campo `certificateRef` está reservado y no se acepta en esta spec.
- `POST /api/v1/machines/:machineId/connection/opcua/test`: cuerpo `{ endpointUrl }`, respuesta `{ reachable, reason? }`.
- `POST /api/v1/machines/:machineId/connection/opcua/browse`: cuerpo `{ endpointUrl, nodeId? }`, respuesta `{ nodes: [...] }`. Es `POST` y no `GET` porque el `endpointUrl` viaja en el cuerpo, no en la URL ni en los logs de acceso.

Las respuestas de `GET /machines` y `GET /machines/:id` incluyen `providerType`, para que la UI muestre el tipo de conexión real.

Validación de variables conocidas: las Signals `FORMULA` (criterio backend 5 de la spec 06) validan sus `variables` contra el conjunto de variables conocidas de la Machine. En una Machine `Simulator` ese conjunto son las semillas de `connectionConfig.signals`; en una `OpcUa`, los `signalVariableName` de `connectionConfig.nodeMapping`.

### Criterios de aceptación backend

1. `PUT .../connection` con una config `OpcUa` válida responde `200`, persiste la config y publica `MachineConnectionReplaced`.
2. Un `PUT .../connection` (en cualquier sentido: Simulator↔OpcUa, OpcUa↔OpcUa) detiene el provider anterior de la Machine y arranca el nuevo sin reiniciar la aplicación.
3. `PUT .../connection` con config `OpcUa` inválida (esquema distinto de `opc.tcp://`, seguridad distinta de `None`/`Anonymous`, `nodeMapping` vacío o con duplicados, `signalVariableName` fuera del patrón de identificador) responde `400`. `Mqtt`/`ModbusTcp` siguen dando `422 PROVIDER_NOT_SUPPORTED`.
4. Con `OPCUA_ALLOWED_HOSTS` definida, `PUT`, `test` y `browse` contra un host fuera de la lista responden `422 OPCUA_ENDPOINT_NOT_ALLOWED` sin abrir ninguna conexión. Si la variable no está definida, se permite cualquier host `opc.tcp://`.
5. `test` responde `{ reachable: true }` contra un servidor alcanzable y `{ reachable: false, reason }` contra uno inalcanzable, sin exponer el detalle técnico del error.
6. `browse` sin `nodeId` devuelve los hijos de `ObjectsFolder`, y con `nodeId` los hijos de ese nodo, cada uno con `nodeId`, `browseName`, `displayName`, `nodeClass`, `dataType` (solo en Variables) y `hasChildren`.
7. El `OpcUaProvider` se suscribe (Subscription + MonitoredItems, sin polling) a todos los nodos de `nodeMapping` y publica una `Variable` por notificación, con `name = signalVariableName`, el valor y tipo del `Variant`, la calidad traducida según la tabla `StatusCode` y `timestamp` igual a la hora de recepción del reloj del Backend, nunca el timestamp del PLC. Un desfase de reloj de más de 5 minutos solo produce un warning por conexión.
8. Al perder la conexión, la Machine publica `MachineDisconnected` (sus Signals pasan a `OFFLINE`) y la métrica de conexión pasa a `0`. Al recuperarla, publica `MachineConnected`, incrementa `ewcontrol_data_provider_reconnects_total` y los valores vuelven a fluir sin intervención.
9. Un endpoint inalcanzable al arrancar no impide ni bloquea el arranque del Backend.
10. Un `nodeId` rechazado por el servidor solo produce un warning con su `nodeId`, sin afectar al resto de variables.
11. Las Signals `FORMULA` de una Machine `OpcUa` se validan contra los `signalVariableName` de su `nodeMapping`.
12. `GET /machines` y `GET /machines/:id` incluyen `providerType`.
13. Crear o editar una Signal de una Machine `OpcUa` conectada hace que el provider republique los últimos valores conocidos, de modo que la Signal tiene valor aunque el PLC no haya cambiado desde la suscripción.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `AdminCliente` en el detalle de una Machine.
- **When** pulsa "Conexión".
- **Then** navega a la pantalla de conexión de esa Machine, que muestra el proveedor actual (Simulador u OPC UA) y su configuración.

- **Given** la pantalla de conexión.
- **When** selecciona "OPC UA", escribe el endpoint (`opc.tcp://192.168.1.1:4840`) y pulsa "Probar conexión".
- **Then** la app llama a `.../opcua/test` y muestra un toast de éxito ("Conexión establecida") o de error con un mensaje legible según `reason`.

- **Given** un endpoint probado con éxito.
- **When** el usuario pulsa "Explorar nodos".
- **Then** aparece un árbol con los hijos de `ObjectsFolder`. Al expandir un nodo con `hasChildren`, la app pide sus hijos a `.../opcua/browse`, y solo entonces, mostrando un indicador de carga mientras tanto.

- **Given** el árbol de nodos.
- **When** el usuario pulsa "Añadir" en un nodo de clase `Variable` con tipo escalar soportado: `Boolean`, `SByte`, `Byte`, `Int16`, `UInt16`, `Int32`, `UInt32`, `Float`, `Double` o `String`.
- **Then**:
  - El nodo se añade a la tabla de mapeo con su `nodeId` y su `dataType`.
  - Tiene un `signalVariableName` editable que por defecto se deriva de la ruta desde el DB, saneada como identificador. Por ejemplo, `"Lectura"."ARRAY_1"[0]."Ancho"` da `Lectura_ARRAY_1_0_Ancho`. Usar solo el `browseName` produciría duplicados (`Ancho` aparece once veces).
  - Un nodo ya añadido muestra el botón deshabilitado.
- **And** las `Variable` de tipo array o struct (`ExtensionObject`) no tienen botón "Añadir", pero se pueden expandir para llegar a sus miembros escalares.

- **Given** una tabla de mapeo con al menos un nodo.
- **When** el usuario pulsa "Guardar".
- **Then**:
  - Si la Machine era del Simulador, se pide antes confirmación en un diálogo: "La Machine dejará de recibir datos simulados; su histórico, Signals, Alarmas y Dashboards se conservan".
  - La app llama a `PUT .../connection` y muestra un toast de éxito.

- **Given** la lista de Machines.
- **When** se carga.
- **Then** la columna "Conexión" muestra el proveedor real de cada Machine ("Simulador" u "OPC UA") en lugar del valor fijo actual.

- **Given** el formulario de una Signal de una Machine `OpcUa`.
- **When** el usuario escribe en el campo de variable.
- **Then** el campo sugiere (`datalist`) los `signalVariableName` del `nodeMapping` de la Machine.

### Casos borde / errores de UI

- **Given** un `endpointUrl` que no empieza por `opc.tcp://`.
- **When** el usuario intenta probar, explorar o guardar.
- **Then** el formulario muestra el error de validación en el propio campo y no se llama al Backend.

- **Given** un `browse` que falla (`502`) o un endpoint no permitido (`422 OPCUA_ENDPOINT_NOT_ALLOWED`).
- **When** el usuario expande un nodo o abre el árbol.
- **Then** se muestra un mensaje de error en el árbol, sin perder los nodos ya cargados ni la tabla de mapeo.

- **Given** dos filas de mapeo con el mismo `signalVariableName`, o una vacía.
- **When** el usuario intenta guardar.
- **Then** el formulario marca las filas en conflicto y no se envía.

- **Given** una tabla de mapeo vacía con OPC UA seleccionado.
- **When** el usuario intenta guardar.
- **Then** el botón "Guardar" está deshabilitado y un texto de ayuda indica que hay que mapear al menos un nodo.

- **Given** una fila de mapeo.
- **When** el usuario pulsa su botón de eliminar.
- **Then** la fila desaparece de la tabla y el nodo vuelve a poder añadirse desde el árbol.

### Componentes/pantallas involucrados

Referencia: [08-frontend-dashboard.md](../08-frontend-dashboard.md) §8.6 (configuración desde el Frontend).

- `config/pages/machine-connection-page/` (nueva): selector de proveedor, formulario de endpoint, "Probar conexión", tabla de mapeo y "Guardar". Ruta `config/machines/:machineId/connection`, enlazada desde `machine-detail-page`.
- `config/components/opc-ua-node-browser/` (nuevo `OpcUaNodeBrowserComponent`): árbol de exploración bajo demanda. Tiene estado (nodos cargados, expandidos, en carga), así que es un componente y no una clase CSS (regla 12.4). Accesible con `role="tree"`/`role="treeitem"`, `aria-expanded`, `aria-busy` durante la carga y navegación por teclado (flechas, Enter).
- `config/entities/machine-connection.model.ts`: `ProviderType = 'Simulator' | 'OpcUa'` y `ConnectionConfig` como unión.
- `config/adapters/machines-api.service.ts`: `testOpcUaConnection` y `browseOpcUaNodes`, junto a los `getConnection`/`replaceConnection` existentes.
- `machine-list-page` (columna "Conexión") y `signal-form-page` (`datalist` de variables).
- Se reutilizan los componentes compartidos existentes: toast, diálogo de confirmación, input y tabla.

### Criterios de aceptación frontend

1. La pantalla de conexión carga y muestra el proveedor y la config actuales de la Machine.
2. "Probar conexión" llama a `.../opcua/test` y muestra un toast de éxito o de error según la respuesta.
3. El árbol de nodos solo pide los hijos de un nodo al expandirlo, y es navegable por teclado con los roles ARIA `tree`/`treeitem` y `aria-expanded`.
4. Solo los nodos `Variable` de tipo escalar soportado se pueden añadir al mapeo. Los arrays y structs se expanden pero no se añaden, y un nodo ya añadido no se puede añadir dos veces.
5. Cada fila de mapeo tiene un `signalVariableName` editable. Por defecto se deriva de la ruta del nodo, saneada al patrón `[A-Za-z_][A-Za-z0-9_]*`. Guardar se bloquea si hay nombres vacíos, duplicados o que no cumplen ese patrón, o si la tabla está vacía.
6. Cambiar de Simulador a OPC UA pide confirmación antes del `PUT`.
7. Un `endpointUrl` sin el esquema `opc.tcp://` se marca como inválido sin llamar al Backend.
8. La lista de Machines muestra el proveedor real de cada una.
9. El formulario de Signal sugiere las variables del `nodeMapping` de una Machine `OpcUa`.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

- **A10 SSRF**: `test`, `browse` y el propio provider abren conexiones salientes hacia un destino que introduce el usuario. Mitigaciones:
  - Solo se acepta el esquema `opc.tcp://`.
  - Allowlist opcional `OPCUA_ALLOWED_HOSTS`, que debe definirse en cualquier despliegue que no sea la modalidad local de planta.
  - Solo pueden usarlo `AdminCliente` y `SuperAdmin`.
  - Timeout corto.
  - Respuestas con motivos genéricos, sin banners ni mensajes del servidor remoto.
- **A01 Control de acceso**: los tres endpoints usan el mismo `MachineAccessResolver` que el resto de `connection`. Una Machine de otra Company devuelve `404`.
- **A04 Mass assignment**: DTOs con `whitelist`/`forbidNonWhitelisted`. `certificateRef` y las credenciales no se aceptan todavía.
- **A05 Configuración**: el detalle de errores de node-opcua va al log, no a la respuesta.
- **Canal sin cifrar (`SecurityMode None`)**: es una limitación aceptada para el piloto. El PLC también ofrece `SignAndEncrypt`/`Basic256Sha256` con `Anonymous`, así que cifrar el canal en una spec posterior no exige credenciales, solo el intercambio de certificados entre el Backend y el PLC. Solo es tolerable en una red OT aislada (cable en planta) o dentro de un túnel VPN cifrado. Queda documentado en 06-seguridad-global.md, y el soporte de `Sign`/`SignAndEncrypt` y de certificados es trabajo futuro.

## Fuera de alcance

- La modalidad remota (Data Provider en el edge que envía a un Backend en la nube, mTLS, buffer local).
- Seguridad OPC UA distinta de `None`/`Anonymous`: usuario/contraseña y certificados X.509.
- Escritura de valores en el PLC (OPC UA Write) y llamadas a métodos.
- El procedimiento de instalación del stack en el PC de planta. Se documenta en [05-despliegue-infraestructura.md](../05-despliegue-infraestructura.md) ("Modo local en planta") dentro del mismo PR, pero no forma parte de los criterios de aceptación.
- Tests e2e con Playwright: requerirían un servidor OPC UA en CI. El flujo queda cubierto con un test de integración contra un servidor OPC UA en proceso y con tests de componentes.
