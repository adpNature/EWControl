# Spec: Sincronización de variables OPC UA

## Contexto

Continúa [18-integracion-opc-ua.md](18-integracion-opc-ua.md) (lectura OPC UA, `nodeMapping`, explorador de nodos) y respeta [20-paquetes-escritura-opc-ua.md](20-paquetes-escritura-opc-ua.md) (variables escribibles).

Con la spec 18, para leer una variable del PLC hay que buscarla en el árbol de nodos y añadirla al `nodeMapping` una a una. La máquina piloto actual (PLC Inovance con runtime CODESYS 3.5) expone unas 19.900 variables. Solo la carpeta `GVL_HMI` tiene 450 escalares. Mapearlas a mano no escala, y además no hay forma de saber si el programa del PLC ha cambiado desde la última vez.

Esta spec añade una pantalla por Machine que:

1. Con **«Sincronizar con OPC UA»** lee todas las variables de una carpeta del servidor (de entrada `GVL_HMI`) y las muestra en un listado con su ruta y su **tipo**.
2. Permite dar a cada variable un **identificador** (el `signalVariableName`, que usan Signals y fórmulas) y una **etiqueta** legible, y **guardarlas** en el `nodeMapping`. A partir de ahí se leen en tiempo real como cualquier otra variable de la spec 18.
3. En cada nueva sincronización **compara** lo que hay en el PLC con lo guardado y avisa de las variables nuevas, eliminadas o con el tipo cambiado. Nunca aplica cambios por su cuenta: el usuario decide.

La sincronización no depende del fabricante del PLC. Solo usa servicios estándar de OPC UA (`Browse` y `Read`), y la carpeta raíz se elige por su `NodeId`.

**PLC piloto (2026-11-06).** Carpeta `ns=4;s=|var|Inovance-ARM-Linux.Application.GVL_HMI`:

- 460 nodos `Variable`: 412 en el primer nivel y 48 elementos de array (`…GVL_HMI.asCtrlTiemposBobina[0]`).
- 450 son escalares mapeables: Boolean 260, Float 91, String 44, Int16 43, UInt16 12.
- 10 son arrays (omitidos; sus elementos sí se listan).
- Cada array lleva además 3 propiedades (`HasProperty`, de tipo `UInt32`), que no son variables del programa y no se recorren.
- Recorrerla nodo a nodo a través de Tailscale tardaba unos 34 s; con el recorrido por lotes que exige esta spec tarda unos 15 s.

## Actor(es)

- `AdminCliente` (Machines de su Company) y `SuperAdmin` (cualquier Company): sincronizan, nombran y guardan.
- `Operador`: sin acceso (`403`), igual que el resto de la configuración ([19-rol-operador.md](19-rol-operador.md)).

## Precondiciones

- El usuario está autenticado ([05-auth-login.md](05-auth-login.md)), y la Machine existe, está activa y pertenece a una Company a la que tiene acceso.
- La Machine tiene una conexión `OpcUa` guardada (spec 18), con un `endpointUrl` permitido por `OPCUA_ALLOWED_HOSTS`. La sincronización usa siempre el endpoint **guardado**, nunca uno recibido en la petición.
- El Backend tiene ruta de red hasta el servidor OPC UA (PC de planta, servidor de desarrollo o, durante el piloto, Tailscale).

## Backend

### Modelo

Sin tablas nuevas: todo vive en el `connectionConfig` (jsonb) de la `MachineConnection`.

```json
{
  "endpointUrl": "opc.tcp://192.168.1.1:4840",
  "variableSyncRootNodeId": "ns=4;s=|var|Inovance-ARM-Linux.Application.GVL_HMI",
  "nodeMapping": [
    {
      "nodeId": "ns=4;s=|var|Inovance-ARM-Linux.Application.GVL_HMI.iBobinadoActual",
      "signalVariableName": "GVL_HMI_iBobinadoActual",
      "label": "Bobinado actual",
      "dataType": "Int16"
    }
  ]
}
```

- `variableSyncRootNodeId` (opcional, ≤ 1024 caracteres): la última carpeta sincronizada y guardada. La pantalla la propone por defecto.
- `nodeMapping[].label` (opcional, ≤ 120 caracteres, se recortan los espacios de los extremos; vacía equivale a ausente): nombre legible para humanos. No interviene en la lectura ni en las fórmulas.
- `nodeMapping[].dataType` ya existía (spec 20). La sincronización lo rellena siempre, porque es la base para detectar cambios de tipo.
- El límite de 500 entradas del `nodeMapping` se mantiene.

**Qué variables se pueden mapear.** Una `Variable` con `ValueRank = -1` (escalar) y un `dataType` de los soportados en la spec 18 (`Boolean`, `SByte`, `Byte`, `Int16`, `UInt16`, `Int32`, `UInt32`, `Float`, `Double`, `String`). El resto se lista como **omitida**, con su motivo:

- `nonScalar`: arrays y `ValueRank` distinto de -1. Si tienen hijos, se recorren igualmente y sus elementos escalares sí se pueden mapear.
- `unsupportedType`: escalares de otro tipo, por ejemplo `DateTime` o una estructura.

**Recorrido.**

- Se recorre por niveles desde la carpeta raíz, siguiendo las referencias jerárquicas hacia delante salvo `HasProperty`. Cada nivel se pide en una sola llamada `Browse`, con `BrowseNext` para las continuaciones.
- `DataType`, `ValueRank`, `ArrayDimensions` y `AccessLevel` se leen con `Read` por lotes.
- Límites: 2.000 nodos `Variable`, profundidad 8 y 60 s en total.

**Comparación.** Cada variable mapeable del PLC se compara por `nodeId` con el `nodeMapping` guardado:

| Estado        | Condición                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unchanged`   | Está guardada con el mismo `dataType`, o la entrada guardada no tenía `dataType` (mapeos anteriores a esta spec).                                                                           |
| `new`         | No está en el `nodeMapping`.                                                                                                                                                                |
| `typeChanged` | Está guardada con un `dataType` distinto del actual.                                                                                                                                        |
| `removed`     | Está en el `nodeMapping`, no aparece bajo la carpeta y el servidor responde `BadNodeIdUnknown` al leer su `DataType`. Las que existen fuera de la carpeta son mapeos manuales y se ignoran. |

### Flujo principal (Given/When/Then)

**Sincronizar**

- **Given** un `AdminCliente` y una Machine `OpcUa` de su Company.
- **When** llama a `POST /api/v1/machines/:machineId/connection/opcua/variables/sync` con `{ "rootNodeId": "ns=4;s=|var|Inovance-ARM-Linux.Application.GVL_HMI" }`.
- **Then**:
  - El Backend abre una sesión efímera contra el `endpointUrl` guardado, recorre la carpeta, comprueba las entradas guardadas que no han aparecido y cierra la sesión.
  - No escribe nada, ni en el PLC ni en la base de datos.
  - Responde `200`:
    ```json
    {
      "rootNodeId": "ns=4;s=|var|Inovance-ARM-Linux.Application.GVL_HMI",
      "syncedAt": "2026-11-06T10:00:00.000Z",
      "summary": {
        "total": 450,
        "new": 3,
        "unchanged": 445,
        "typeChanged": 2,
        "removed": 1,
        "skipped": 10,
        "byDataType": {
          "Boolean": 260,
          "Float": 91,
          "String": 44,
          "Int16": 43,
          "UInt16": 12
        }
      },
      "variables": [
        {
          "nodeId": "ns=4;s=|var|Inovance-ARM-Linux.Application.GVL_HMI.iBobinadoActual",
          "path": ["GVL_HMI", "iBobinadoActual"],
          "dataType": "Int16",
          "plcWritable": true,
          "status": "typeChanged",
          "saved": {
            "signalVariableName": "GVL_HMI_iBobinadoActual",
            "label": "Bobinado actual",
            "dataType": "UInt16"
          }
        }
      ],
      "removed": [
        {
          "nodeId": "…GVL_HMI.xAntigua",
          "signalVariableName": "GVL_HMI_xAntigua",
          "label": null,
          "dataType": "Boolean"
        }
      ],
      "skipped": [
        {
          "nodeId": "…GVL_HMI.awIPaddressHMI",
          "path": ["GVL_HMI", "awIPaddressHMI"],
          "dataType": "UInt16",
          "valueRank": 1,
          "arrayDimensions": [4],
          "reason": "nonScalar"
        }
      ]
    }
    ```
  - `path` son los `BrowseName` desde la carpeta raíz, incluida. `saved` es `null` en las variables `new`.
  - `plcWritable` es informativo: refleja el bit `CurrentWrite` del `AccessLevel`. No marca la variable como escribible en EWControl; eso sigue siendo cosa de la spec 20.
  - `variables` va ordenado por `path`.

**Guardar**

- **Given** el resultado de una sincronización.
- **When** llama a `PUT /api/v1/machines/:machineId/connection/opcua/variables` con:
  ```json
  {
    "rootNodeId": "ns=4;s=|var|Inovance-ARM-Linux.Application.GVL_HMI",
    "variables": [
      {
        "nodeId": "…GVL_HMI.iBobinadoActual",
        "signalVariableName": "GVL_HMI_iBobinadoActual",
        "label": "Bobinado actual",
        "dataType": "Int16"
      }
    ],
    "remove": ["…GVL_HMI.xAntigua"]
  }
  ```
- **Then**:
  - Cada elemento de `variables` se fusiona con el `nodeMapping` por `nodeId`:
    - Si ya existe, se actualizan `signalVariableName`, `label` y `dataType`, y se conservan `writable`, `min` y `max`.
    - Si no existe, se añade.
  - Las entradas de `remove` se quitan.
  - Las entradas del `nodeMapping` que no aparecen ni en `variables` ni en `remove` (por ejemplo, mapeos manuales de otras carpetas) **no se tocan**.
  - `variableSyncRootNodeId` pasa a valer `rootNodeId`.
  - La configuración resultante se valida igual que en `PUT .../connection` (spec 18) y se persiste en una transacción.
  - Se publica `MachineConnectionReplaced`: el `OpcUaProvider` de la Machine se reinicia con el nuevo mapeo, sin reiniciar la aplicación, y las variables nuevas empiezan a leerse en tiempo real.
  - Responde `200` con la `MachineConnection` actualizada, con la misma forma que `PUT .../connection`.

- **Given** una variable guardada cuyo `dataType` cambia al guardar y que estaba marcada como escribible (spec 20).
- **When** se guarda.
- **Then** pierde `writable`, `min` y `max`, porque los límites del tipo anterior pueden no tener sentido con el nuevo. Los paquetes de escritura que la usen darán `409 WRITE_PACKAGE_OUTDATED` al ejecutarse, como ya define la spec 20, hasta que se revisen.

### Casos borde / errores (Given/When/Then)

- **Given** una Machine o Company ajena, inexistente o dada de baja.
- **When** se sincroniza o se guarda.
- **Then** `404 MACHINE_NOT_FOUND`.

- **Given** un `Operador`.
- **When** llama a cualquiera de los dos endpoints.
- **Then** `403`.

- **Given** una Machine del Simulador.
- **When** se sincroniza o se guarda.
- **Then** `409 MACHINE_NOT_OPCUA`, sin abrir ninguna conexión.

- **Given** un `endpointUrl` guardado cuyo host ya no está en `OPCUA_ALLOWED_HOSTS`.
- **When** se sincroniza o se guarda.
- **Then** `422 OPCUA_ENDPOINT_NOT_ALLOWED`, sin abrir ninguna conexión (OWASP A10).

- **Given** un servidor inalcanzable.
- **When** se sincroniza.
- **Then** `502 OPCUA_ENDPOINT_UNREACHABLE`. Si el recorrido supera los 60 s, `504 OPCUA_SYNC_TIMEOUT`. En ambos casos se cierra la sesión.

- **Given** un `rootNodeId` sintácticamente inválido o que no existe en el servidor.
- **When** se sincroniza.
- **Then** `400 OPCUA_INVALID_NODE_ID`.

- **Given** una carpeta con más de 2.000 variables.
- **When** se sincroniza.
- **Then** `422 OPCUA_SYNC_TOO_MANY_NODES`, con un mensaje que pide elegir una carpeta más concreta. No se devuelve un listado parcial.

- **Given** un guardado que cambia el `signalVariableName` de una variable, o la quita con `remove`.
- **When** ese nombre lo usa una Signal de la Machine (`DIRECT` por `variableName`, o `FORMULA` en `variables`) o un paquete de escritura activo.
- **Then**:
  - `409 OPCUA_VARIABLE_IN_USE` y no se guarda nada.
  - `details` lista, por variable, quién la usa: `[{ "signalVariableName": "…", "usedBy": [{ "kind": "Signal" | "WritePackage", "id": "…", "name": "…" }] }]`.
  - Cambiar solo la `label` o el `dataType` nunca da este error.

- **Given** un guardado con identificadores repetidos (entre sí o con el resto del mapeo), un identificador que no cumple `^[A-Za-z_][A-Za-z0-9_]*$`, un `dataType` no soportado, una `label` de más de 120 caracteres o un `remove` que deja el mapeo vacío.
- **When** se guarda.
- **Then** `400 INVALID_CONNECTION_CONFIG`, con el motivo, y no se guarda nada.

- **Given** un guardado tras el que el `nodeMapping` superaría las 500 entradas.
- **When** se guarda.
- **Then** `422 OPCUA_MAPPING_LIMIT`, con el número de entradas resultante.

- **Given** un `nodeId` de `remove` que no está en el mapeo.
- **When** se guarda.
- **Then** se ignora: borrar algo que ya no está es idempotente.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección "MachineConnection":

| Método | Ruta                                                          | Roles                    |
| ------ | ------------------------------------------------------------- | ------------------------ |
| POST   | `/api/v1/machines/:machineId/connection/opcua/variables/sync` | AdminCliente, SuperAdmin |
| PUT    | `/api/v1/machines/:machineId/connection/opcua/variables`      | AdminCliente, SuperAdmin |

- La sincronización es `POST` y no `GET` porque el `rootNodeId` puede llevar caracteres (`|`, `"`, `[`) que conviene no poner en la URL ni en los logs de acceso, y porque abre una conexión saliente.
- `PUT .../connection` (spec 18) acepta y conserva los campos nuevos `variableSyncRootNodeId` y `nodeMapping[].label`.

### Criterios de aceptación backend

1. `parseOpcUaConnectionConfig` acepta `variableSyncRootNodeId` y `nodeMapping[].label` con sus límites, y sigue rechazando cualquier otro campo desconocido.
2. La sincronización recorre la carpeta por niveles con `Browse` por lotes y lee los atributos con `Read` por lotes. Devuelve las variables mapeables con `path`, `dataType` y `plcWritable`, y las omitidas con `valueRank`, `arrayDimensions` y `reason`. No sigue `HasProperty`.
3. Los elementos escalares de un array se devuelven como mapeables. El array en sí se devuelve como omitido (`nonScalar`).
4. La comparación clasifica cada variable como `new`, `unchanged` o `typeChanged`, y las entradas guardadas desaparecidas como `removed` solo si el servidor confirma `BadNodeIdUnknown`. Los mapeos que existen fuera de la carpeta no aparecen como eliminados.
5. `summary` cuenta `total`, `new`, `unchanged`, `typeChanged`, `removed`, `skipped` y `byDataType`.
6. La sincronización no escribe nada y usa el `endpointUrl` guardado, sometido a `OPCUA_ALLOWED_HOSTS`.
7. Errores: `404`, `403` para el `Operador`, `409 MACHINE_NOT_OPCUA`, `422 OPCUA_ENDPOINT_NOT_ALLOWED`, `400 OPCUA_INVALID_NODE_ID`, `502 OPCUA_ENDPOINT_UNREACHABLE`, `504 OPCUA_SYNC_TIMEOUT` y `422 OPCUA_SYNC_TOO_MANY_NODES`, como se describe en los casos borde.
8. El guardado fusiona por `nodeId`, conserva `writable`/`min`/`max` salvo si cambia el tipo, no toca las entradas no mencionadas, actualiza `variableSyncRootNodeId` y publica `MachineConnectionReplaced`.
9. Renombrar o quitar una variable en uso da `409 OPCUA_VARIABLE_IN_USE` con el detalle de usos, sin guardar nada.
10. Validación del guardado: `400 INVALID_CONNECTION_CONFIG` (identificadores, tipos, etiqueta, mapeo vacío) y `422 OPCUA_MAPPING_LIMIT`.
11. Test de integración contra el servidor OPC UA de desarrollo, que añade una carpeta tipo CODESYS `GVL_HMI`: sincroniza; luego añade un nodo, quita otro y cambia el tipo de un tercero; vuelve a sincronizar y comprueba `new`, `removed` y `typeChanged`.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** el detalle de una Machine `OpcUa` y un usuario `AdminCliente` o `SuperAdmin`.
- **When** pulsa **«Variables OPC UA»**, junto a «Conexión».
- **Then** navega a `/config/machines/:machineId/opcua-variables`, con el breadcrumb Machines › _máquina_ › Variables OPC UA. La pantalla muestra:
  - El campo «Carpeta OPC UA (NodeId)», con el `variableSyncRootNodeId` guardado o vacío. El texto de ayuda pone un ejemplo (`ns=4;s=|var|…Application.GVL_HMI`).
  - El botón **«Sincronizar con OPC UA»**.
  - Un texto que invita a sincronizar.

- **Given** una carpeta escrita.
- **When** pulsa «Sincronizar con OPC UA».
- **Then**:
  - El botón se deshabilita y cambia a «Sincronizando…», con `aria-busy="true"` en la zona del listado, hasta que llega la respuesta.
  - Aparece un **resumen** (`role="status"`):
    - «450 variables · 3 nuevas · 1 eliminada · 2 con tipo cambiado · 10 omitidas», o «Sin cambios respecto a lo guardado» si no hay nuevas, eliminadas ni cambios de tipo;
    - el desglose por tipo («BOOL 260 · REAL 91 · …»).
  - Aparece el **listado de variables**, con estas columnas:
    - **Estado**: chip «Guardada», «Nueva» o «Tipo cambiado».
    - **Ruta**: `path` unido con `.`, sin la carpeta raíz.
    - **Tipo**: el tipo de PLC (IEC 61131-3) en grande y el tipo OPC UA debajo, en texto secundario (ver tabla). En `typeChanged` se ve «UINT → INT».
    - **Escritura PLC**: «Sí» o «No», según `plcWritable`.
    - **Identificador**: campo editable con el `signalVariableName` guardado o, en las nuevas, uno derivado de la ruta (`GVL_HMI_iBobinadoActual`, `GVL_HMI_asCtrlTiemposBobina_0`).
    - **Etiqueta**: campo editable, con la guardada o vacío.

  | Tipo OPC UA | Tipo PLC |
  | ----------- | -------- |
  | Boolean     | BOOL     |
  | SByte       | SINT     |
  | Byte        | USINT    |
  | Int16       | INT      |
  | UInt16      | UINT     |
  | Int32       | DINT     |
  | UInt32      | UDINT    |
  | Float       | REAL     |
  | Double      | LREAL    |
  | String      | STRING   |

  Cualquier otro tipo muestra solo su nombre OPC UA.

- **Given** el listado.
- **When** el usuario usa los filtros.
- **Then** puede combinar:
  - un filtro de estado: Todas, Nuevas, Tipo cambiado, Eliminadas;
  - un filtro de tipo: un `<select>` con los tipos presentes y su recuento, como «BOOL (260)»;
  - una búsqueda por texto sobre ruta, identificador y etiqueta.

  Los filtros solo ocultan filas: lo editado en filas ocultas se conserva y se guarda.

- **Given** una sincronización con variables `removed`.
- **When** se muestra el resultado.
- **Then** aparece la sección **«Eliminadas en el PLC»**. Cada fila muestra el identificador, la etiqueta y el tipo guardados, y una casilla **«Quitar del mapeo»** que por defecto está desmarcada. Nada se quita sin marcarla.

- **Given** una sincronización con variables omitidas.
- **When** se muestra el resultado.
- **Then** hay una sección plegable (`<details>`) **«Omitidas (10)»**. Lista su ruta, su tipo y el motivo, por ejemplo «Array de UINT [4]» o «Tipo no soportado: DateTime».

- **Given** el listado, con o sin cambios.
- **When** pulsa **«Guardar»**.
- **Then**:
  - Se abre una confirmación: «Se guardarán N variables en la Machine y se reiniciará su lectura en tiempo real», más «Se quitarán M» si hay casillas marcadas.
  - Al confirmar, se envía al `PUT`: en `variables`, todas las variables mapeables del listado, con su identificador, su etiqueta y el `dataType` actual; en `remove`, las marcadas.
  - Se muestra un toast de éxito.
  - El resumen pasa a «Sin cambios respecto a lo guardado», y las filas, a «Guardada».

- **Given** el formulario de una Signal de una Machine `OpcUa` (spec 18).
- **When** el campo de variable sugiere los `signalVariableName` (`datalist`).
- **Then** cada sugerencia muestra también su etiqueta, si la tiene.

### Casos borde / errores de UI

- **Given** el campo de carpeta vacío.
- **When** se muestra la pantalla.
- **Then** «Sincronizar con OPC UA» está deshabilitado.

- **Given** un error al sincronizar (`502`, `504`, `400`, `422`).
- **When** llega la respuesta.
- **Then**:
  - Se muestra un mensaje legible según el código (`role="alert"`), por ejemplo: «No se ha podido conectar con la máquina», «La máquina ha tardado demasiado en responder», «La carpeta no existe en el servidor» o «La carpeta tiene más de 2.000 variables: elige una más concreta».
  - Se conserva el último listado, si lo había, junto con lo editado.

- **Given** filas con el identificador vacío, inválido o repetido (entre filas o con otros mapeos de la Machine).
- **When** el usuario intenta guardar.
- **Then** las filas se marcan con su error junto al campo, el filtro cambia a «Todas» para que se vean, y no se envía nada.

- **Given** un `409 OPCUA_VARIABLE_IN_USE`.
- **When** llega la respuesta.
- **Then** las filas afectadas se marcan con «Se usa en: Signal "Velocidad", Paquete "Formato 120"» y no se pierde nada de lo editado.

- **Given** un `422 OPCUA_MAPPING_LIMIT`.
- **When** llega la respuesta.
- **Then** se muestra «El mapeo superaría el máximo de 500 variables (N)».

- **Given** la confirmación de guardado.
- **When** el usuario cancela o pulsa Escape.
- **Then** no se envía nada. Mientras se guarda, «Guardar» y «Sincronizar» están deshabilitados, sin doble envío.

- **Given** un listado sin sincronizar todavía.
- **When** se muestra la pantalla.
- **Then** «Guardar» no aparece.

### Componentes/pantallas involucrados

Referencia: [08-frontend-dashboard.md](../08-frontend-dashboard.md) §8.6 (configuración desde el Frontend).

- `config/pages/machine-opcua-variables-page/` (nueva): carpeta, sincronizar, resumen, filtros, listado editable, eliminadas, omitidas y guardar.
  - Tabla propia como la de «Variables mapeadas» de `machine-connection-page`, porque `TableComponent` no admite campos editables.
  - Los chips de estado son una clase global con modificadores (`.status-chip--new`…): no tienen estado propio (regla 12.4) y consumen tokens de color.
- `config/use-cases/opc-ua-variable-sync.ts` (nuevo), con funciones puras: `plcTypeLabel`, `deriveIdentifierFromPath`, filtrado, validación de filas y textos del resumen y de los errores.
- `config/pages/machine-detail-page`: botón «Variables OPC UA», visible solo si `canConfigure()` y la Machine es `OpcUa`.
- `config/pages/machine-connection-page`: conserva `label` y `variableSyncRootNodeId` al guardar, para no borrarlos.
- `config/pages/signal-form-page` (o el componente con el `datalist` de la spec 18): la etiqueta en las sugerencias.
- `config/adapters/machines-api.service.ts`: `syncOpcUaVariables` y `saveOpcUaVariables`.

### Criterios de aceptación frontend

1. «Variables OPC UA» solo aparece en Machines `OpcUa` y para `AdminCliente`/`SuperAdmin`. La ruta queda bajo `configGuard`.
2. «Sincronizar con OPC UA» llama al endpoint con la carpeta escrita, muestra el estado de carga accesible y luego el resumen y el listado.
3. Cada fila muestra estado, ruta, tipo PLC + tipo OPC UA (con «antes → ahora» en los cambios de tipo), escritura PLC, identificador y etiqueta. Las nuevas traen un identificador derivado de la ruta.
4. Los filtros de estado y tipo y la búsqueda se combinan, y no pierden lo editado en filas ocultas.
5. Las eliminadas solo se quitan marcando su casilla. Las omitidas se ven, con tipo y motivo, en una sección plegable.
6. «Guardar» valida antes de enviar, pide confirmación, envía `variables` y `remove` y refleja el éxito en el resumen y las filas.
7. Los errores de sincronización y guardado (`OPCUA_VARIABLE_IN_USE`, `OPCUA_MAPPING_LIMIT`, `502`, `504`…) muestran mensajes legibles sin perder el listado ni lo editado.
8. La pantalla «Conexión» conserva `label` y `variableSyncRootNodeId`, y las sugerencias de variable del formulario de Signal muestran la etiqueta.
9. Accesibilidad: campos con `label` asociada (identificador y etiqueta con nombre accesible por fila), resumen con `role="status"`, errores con `role="alert"`, `aria-busy` durante la sincronización, y la tabla navegable con teclado.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

- **A01 (control de acceso)**: `@roles(...CONFIGURATION_ROLES)` en los dos endpoints, y la tenencia la resuelve `MachineAccessResolver` (otra Company → `404`). El `Operador` recibe `403`.
- **A10 (SSRF)**: la sincronización no acepta un endpoint en la petición: usa el guardado y vuelve a pasarlo por `OPCUA_ALLOWED_HOSTS` antes de conectar.
- **A04 (diseño inseguro / consumo de recursos)**: límites de 2.000 variables, profundidad 8 y 60 s por sincronización, y la sesión se cierra siempre. Sincronizar es solo lectura: nunca escribe en el PLC.
- **A03 (inyección)**: `rootNodeId` y los `nodeId` se validan en longitud y forma antes de llegar a `node-opcua`. Los identificadores siguen el patrón del motor de fórmulas. La etiqueta es texto plano con longitud acotada, y Angular la interpola sin `innerHTML`.
- **Integridad**: renombrar o quitar variables en uso queda bloqueado (`409`), así que un guardado no puede dejar Signals ni paquetes apuntando a nombres inexistentes.

## Fuera de alcance

- Sincronización automática o periódica, y avisos de cambios sin pulsar el botón.
- Varias carpetas raíz por Machine (se puede sincronizar otra, pero solo se recuerda la última).
- Selección parcial: guardar solo algunas variables de la carpeta.
- Elegir la carpeta desde el árbol de la spec 18 (se escribe su NodeId).
- Arrays y estructuras como variables completas (solo sus elementos escalares).
- Leer el valor actual de cada variable en el listado.
