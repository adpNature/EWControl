# Spec: Paquetes de escritura OPC UA

## Contexto

Segunda de las dos specs para **escribir en la máquina**, sobre la base de [18-integracion-opc-ua.md](18-integracion-opc-ua.md) (lectura OPC UA) y [19-rol-operador.md](19-rol-operador.md) (rol `Operador`).

Hasta ahora EWControl solo lee del PLC. Esta spec añade la escritura con un modelo de **recetas cerradas**:

1. `AdminCliente`/`SuperAdmin` marcan en el mapeo de la conexión qué variables son **escribibles**, con límites opcionales.
2. Con esas variables montan **paquetes de escritura**: un nombre y una lista fija de pares variable → valor (p. ej. "Formato 120 mm": `Escritura_REAL = 120.0`, `Escritura_BOOL = true`).
3. Cualquiera de los tres roles **ejecuta** un paquete. Al ejecutarlo, el Backend escribe todos sus valores en el PLC con una sola petición OPC UA `Write` y deja constancia en un registro de auditoría.

El `Operador` nunca elige valores: solo elige qué paquete ejecutar. Nunca se escribe a un NodeId arbitrario: solo a variables mapeadas y marcadas como escribibles.

**PLC piloto.** El volcado de la spec 18 muestra un DB `Escritura` con `BOOL`, `INT`, `DINT`, `REAL`, `LREAL` y un `ARRAY[0..10]` de structs `Ancho`/`Alto`/`Profundo` (todos `Float`), pensado para pruebas. Escribir en él durante la verificación está autorizado.

## Actor(es)

- `AdminCliente` (su Company) y `SuperAdmin` (cualquiera): marcan variables escribibles, gestionan paquetes, los ejecutan y consultan su historial.
- `Operador` (su Company): ve los paquetes de las Machines de su Company, los ejecuta y consulta su historial.
- **Sistema** (`OpcUaProviderRegistry`): escribe con la sesión OPC UA ya abierta de la Machine.

## Precondiciones

- La Machine es `OpcUa` y su provider está conectado (spec 18).
- Las variables a escribir están en el `nodeMapping` de la Machine y marcadas como escribibles.

## Backend

### Modelo

**Variables escribibles.** Cada entrada de `nodeMapping` admite tres campos opcionales nuevos:

```json
{
  "nodeId": "ns=3;s=\"Escritura\".\"REAL\"",
  "signalVariableName": "Escritura_REAL",
  "writable": true,
  "dataType": "Float",
  "min": 0,
  "max": 500
}
```

- `writable` (por defecto `false`): solo con `true` la variable puede formar parte de un paquete.
- `dataType`: obligatorio si `writable`, uno de los tipos escalares soportados en la spec 18. Lo rellena la UI con el `dataType` del nodo explorado. Sirve para validar los valores de los paquetes; en cada escritura se comprueba además contra el tipo real del servidor.
- `min`/`max`: opcionales, solo para tipos numéricos. Ningún paquete puede guardar un valor fuera de ellos.

**Paquete de escritura** (`WritePackage`, tabla `write_packages`, migración nueva): `id`, `machineId`, `name` (único por Machine), `description?`, `items: [{ signalVariableName, value }]` (1 a 50 elementos, sin variables repetidas), `isActive` y fechas de auditoría. Pertenece a una Machine y hereda su Company.

**Ejecución** (`WritePackageExecution`, tabla `write_package_executions`, migración nueva): `id`, `packageId`, `machineId`, `companyId`, `userId`, `userEmail`, `executedAt`, `status` (`SUCCESS` | `PARTIAL` | `FAILED`) e `items: [{ signalVariableName, nodeId, value, statusCode }]`. Es inmutable: nunca se edita ni se borra.

### Flujo principal (Given/When/Then)

**Configuración**

- **Given** una Machine `OpcUa`.
- **When** un `AdminCliente` guarda su conexión (`PUT .../connection`) con una entrada de `nodeMapping` marcada `writable: true`, con `dataType` y límites.
- **Then** la API la acepta y la persiste.

- **Given** una Machine con variables escribibles.
- **When** un `AdminCliente` llama a `POST /api/v1/machines/:machineId/write-packages` con `{ "name": "Formato 120 mm", "items": [{ "signalVariableName": "Escritura_REAL", "value": 120.0 }, { "signalVariableName": "Escritura_BOOL", "value": true }] }`.
- **Then** la API responde `201` con el paquete creado.
- **And** también hay `GET` (listado y detalle), `PATCH` y `DELETE` (baja lógica) del paquete.

**Ejecución**

- **Given** un paquete activo de una Machine `OpcUa` conectada, y un User de cualquiera de los tres roles con acceso a esa Company.
- **When** llama a `POST /api/v1/machines/:machineId/write-packages/:id/execute`.
- **Then** el Backend:
  1. Revalida cada elemento contra la configuración **actual** de la Machine: sigue mapeado, sigue escribible y el valor respeta tipo y límites.
  2. Escribe todos los valores en **una sola petición OPC UA `Write`**, usando la sesión del `OpcUaProvider` de la Machine.
  3. Registra la ejecución con el `StatusCode` de cada valor.
  4. Responde `200` con la ejecución: `status` global y resultado por elemento.
- **And** la lectura (Subscription de la spec 18) recoge el nuevo valor si la variable escrita también se lee.

- **Given** una Machine con ejecuciones.
- **When** se llama a `GET /api/v1/machines/:machineId/write-packages/:id/executions` (más recientes primero, paginado).
- **Then** se devuelve el historial de ese paquete, con quién lo ejecutó, cuándo y el resultado por elemento.

### Casos borde / errores (Given/When/Then)

- **Given** un `Operador`.
- **When** intenta crear, editar o borrar un paquete, o marcar variables escribibles.
- **Then** la API responde `403` (spec 19).

- **Given** un paquete con un valor fuera de `min`/`max`, de un tipo que no corresponde (p. ej. `"abc"` para un `Float`, `3.5` para un `Int16` o `40000` para un `Int16`) o que referencia una variable no escribible.
- **When** se crea o edita.
- **Then** la API responde `400 INVALID_WRITE_PACKAGE`, indicando el elemento.

- **Given** un paquete creado cuando sus variables eran escribibles, y una configuración de conexión que ha cambiado después (variable desmarcada, quitada del mapeo o con límites que ya no admiten el valor).
- **When** se ejecuta.
- **Then** la API responde `409 WRITE_PACKAGE_OUTDATED`, **sin escribir nada**, y lo registra como ejecución `FAILED`.

- **Given** una Machine `Simulator`, o `OpcUa` sin conexión con el PLC.
- **When** se ejecuta un paquete.
- **Then** la API responde `409 MACHINE_NOT_CONNECTED` (o `422 PROVIDER_NOT_SUPPORTED` si es `Simulator`) sin escribir nada.

- **Given** una ejecución en curso en una Machine.
- **When** llega otra ejecución para la misma Machine.
- **Then** la segunda responde `409 WRITE_IN_PROGRESS`. No se encolan escrituras: el usuario la repite si sigue siendo necesaria.

- **Given** un servidor que rechaza alguno de los valores (`BadNotWritable`, `BadTypeMismatch`, `BadOutOfRange`, `BadUserAccessDenied`…).
- **When** se ejecuta el paquete.
- **Then** la ejecución queda como `PARTIAL` (algún elemento correcto) o `FAILED` (ninguno) con el `StatusCode` de cada uno, y la API responde `200` con ese detalle. OPC UA no garantiza escrituras atómicas entre varios nodos, así que no se intenta revertir los elementos ya escritos.

- **Given** un tipo real del nodo distinto del `dataType` configurado.
- **When** se ejecuta.
- **Then** ese elemento falla con `BadTypeMismatch` sin enviarlo al servidor.

- **Given** una petición `Write` que no recibe respuesta en `timeoutMs`.
- **When** vence el plazo.
- **Then** la ejecución queda `FAILED` con motivo `TIMEOUT`. Algún valor pudo llegar a escribirse, y el historial lo advierte.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección nueva "WritePackage":

| Método | Ruta                                                        | Roles                    |
| ------ | ----------------------------------------------------------- | ------------------------ |
| GET    | `/api/v1/machines/:machineId/write-packages`                | Los tres                 |
| GET    | `/api/v1/machines/:machineId/write-packages/:id`            | Los tres                 |
| POST   | `/api/v1/machines/:machineId/write-packages`                | AdminCliente, SuperAdmin |
| PATCH  | `/api/v1/machines/:machineId/write-packages/:id`            | AdminCliente, SuperAdmin |
| DELETE | `/api/v1/machines/:machineId/write-packages/:id`            | AdminCliente, SuperAdmin |
| POST   | `/api/v1/machines/:machineId/write-packages/:id/execute`    | Los tres                 |
| GET    | `/api/v1/machines/:machineId/write-packages/:id/executions` | Los tres                 |

Evento interno nuevo `WritePackageExecuted` (para métricas y una futura notificación). La métrica `ewcontrol_write_package_executions_total{status}` cuenta las ejecuciones por resultado.

### Criterios de aceptación backend

1. `nodeMapping` acepta `writable`, `dataType`, `min` y `max`. Una entrada `writable` sin `dataType` soportado, o con `min > max`, da `400`.
2. CRUD de paquetes para `AdminCliente`/`SuperAdmin` con validación de tipo, límites y escribibilidad (`400 INVALID_WRITE_PACKAGE`). El `Operador` recibe `403` en la creación, edición y borrado.
3. Los tres roles listan y ejecutan los paquetes de las Machines de su Company. Para otra Company, `404`.
4. La ejecución escribe todos los valores en una sola petición OPC UA `Write` con la sesión del provider, y devuelve y registra el `StatusCode` de cada elemento.
5. La ejecución revalida contra la configuración actual. Si el paquete ha quedado desfasado: `409 WRITE_PACKAGE_OUTDATED`, sin escribir nada.
6. Sin conexión: `409 MACHINE_NOT_CONNECTED`. Machine del Simulador: `422`. Ejecución simultánea en la misma Machine: `409 WRITE_IN_PROGRESS`. En los tres casos no se escribe nada.
7. Un rechazo parcial del servidor da `PARTIAL`, y uno total da `FAILED`, sin revertir.
8. Toda ejecución (también las rechazadas antes de escribir) queda en `write_package_executions` con User, fecha, valores y resultado. El historial es solo de lectura.
9. Test de integración contra el servidor OPC UA de desarrollo: escribe un paquete en el DB `Escritura` y relee los valores.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

**Configuración (AdminCliente/SuperAdmin)**

- **Given** la pantalla "Conexión" de una Machine OPC UA (spec 18).
- **When** el usuario marca "Escribible" en una fila de la tabla de mapeo.
- **Then** aparecen los campos `mín`/`máx` (solo en tipos numéricos), y el `dataType` se guarda con la fila.

- **Given** el detalle de una Machine OPC UA.
- **When** el usuario entra en la pestaña "Paquetes de escritura" y pulsa "Nuevo paquete".
- **Then** ve un formulario con nombre, descripción y una lista de filas variable → valor. El selector solo ofrece variables escribibles, y el campo de valor se adapta al tipo: interruptor para booleanos, numérico con límites o texto.

**Ejecución (los tres roles)**

- **Given** cualquier User en la nueva sección **"Paquetes"** de la barra lateral, visible también para el `Operador`.
- **When** elige una Machine.
- **Then** ve sus paquetes activos, con los valores que escribe cada uno y el resultado de su última ejecución.

- **Given** un paquete.
- **When** el usuario pulsa "Ejecutar".
- **Then**:
  - Se abre un diálogo de confirmación con la lista exacta de variables y valores que se van a escribir en la máquina.
  - Al confirmar, se llama a `execute` y se muestra el resultado por variable: correcto, o el error del servidor traducido.

- **Given** un Dashboard.
- **When** un `AdminCliente` añade un widget de tipo **"Paquete"** que apunta a un paquete.
- **Then** el widget muestra un botón "Ejecutar <nombre>" con la misma confirmación, utilizable por los tres roles (el `Operador` lo usa pero no lo configura).

- **Given** un paquete.
- **When** el usuario abre "Historial".
- **Then** ve las ejecuciones: quién, cuándo, resultado global y detalle por variable.

### Casos borde / errores de UI

- **Given** una Machine desconectada o del Simulador.
- **When** se muestra la pantalla de paquetes o el widget.
- **Then** el botón "Ejecutar" aparece deshabilitado, con el motivo visible.

- **Given** una ejecución `PARTIAL`, `FAILED`, `WRITE_PACKAGE_OUTDATED` o `WRITE_IN_PROGRESS`.
- **When** llega la respuesta.
- **Then** se muestra un mensaje claro y el detalle por variable, sin dar a entender que se ha escrito lo que no se ha escrito.

- **Given** el diálogo de confirmación.
- **When** el usuario cancela o pulsa Escape.
- **Then** no se envía nada. Con el diálogo abierto, el botón "Ejecutar" no admite doble envío.

### Componentes/pantallas involucrados

Referencia: [08-frontend-dashboard.md](../08-frontend-dashboard.md).

- `config/pages/machine-connection-page`: columna "Escribible" y límites en la tabla de mapeo.
- `config/pages/write-package-form-page` (nueva): alta y edición de paquetes.
- Nueva sección `operations/` con `write-packages-page`: listado por Machine, ejecución e historial. Ruta `/paquetes`, accesible a los tres roles.
- Componente compartido `WritePackageExecuteButton`: botón, confirmación y resultado, reutilizado por la página y por el widget.
- `dashboard/widgets/package` (nuevo tipo de widget `PACKAGE`).

### Criterios de aceptación frontend

1. Marcar una fila como escribible pide `dataType` (rellenado automáticamente) y permite `mín`/`máx` en los tipos numéricos.
2. El formulario de paquete solo ofrece variables escribibles y valida tipo y límites antes de enviar.
3. "Ejecutar" siempre pide confirmación mostrando las variables y valores exactos, y no permite el doble envío.
4. El resultado muestra el estado por variable. `PARTIAL`/`FAILED` se distinguen claramente de `SUCCESS`.
5. La sección "Paquetes" y el widget de paquete funcionan con el rol `Operador`, que no ve controles de crear ni editar.
6. Con la Machine desconectada o del Simulador, "Ejecutar" está deshabilitado y explica el motivo.
7. El historial de ejecuciones muestra quién, cuándo y el resultado por variable.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

- **Riesgo físico**: escribir en un PLC actúa sobre una máquina real. Mitigaciones:
  - Solo variables marcadas como escribibles.
  - Valores fijos, validados en tipo y límites.
  - Confirmación explícita en la UI.
  - Revalidación al ejecutar.
  - Sin escrituras concurrentes por Machine.
  - Auditoría inmutable.
- **A01**: crear y editar paquetes es solo para `AdminCliente`/`SuperAdmin`. Ejecutar es para los tres roles, siempre dentro de su Company.
- **A04**: nunca se acepta un `nodeId` ni un valor libre en `execute`: el cuerpo va vacío y todo sale del paquete guardado.
- **A08/A09**: cada ejecución registra User, fecha, valores y `StatusCode`. El registro no se puede editar ni borrar por API.
- **Canal sin cifrar**: con `SecurityMode None` (spec 18), cualquiera con acceso a la red OT puede escribir en el PLC, con o sin EWControl. Escribir desde EWControl no amplía ese riesgo, pero lo hace más visible. Pasar a `SignAndEncrypt` y quitar las escrituras anónimas en el PLC queda como trabajo prioritario fuera de esta spec. Durante el piloto, desactiva la ruta de Tailscale cuando no se use.

## Fuera de alcance

- Valores introducidos por el `Operador` al ejecutar (recetas parametrizables).
- Programar ejecuciones o encadenar paquetes.
- Escritura en Machines del Simulador.
- Llamadas a métodos OPC UA (`Call`).
- Aprobaciones con doble firma (un segundo usuario que autorice la ejecución).
