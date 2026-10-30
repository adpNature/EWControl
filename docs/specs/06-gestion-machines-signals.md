# Spec: Gestión de Machines y Signals (CRUD)

## Contexto

Hoy la única forma de que exista una `Machine` o una `Signal` es el seed de entorno demo ([01-fundacion-entorno-demo.md](01-fundacion-entorno-demo.md)): ningún usuario puede dar de alta, editar o eliminar una `Machine` ni una `Signal` propia. El Documento 3 (apartados [3.2.3](../03-modelo-de-datos.md) `Machine`, 3.2.4 `MachineConnection` y 3.2.5 `Signal`) y el Documento 8 (apartado [8.6](../08-frontend-dashboard.md), "Configuración desde el Frontend") ya describen esta funcionalidad como parte del dominio, y el Documento 11 ([11-api-rest.md](../11-api-rest.md), secciones "Machine", "MachineConnection" y "Signal") ya cataloga su contrato REST, pero ninguno de los dos tiene implementación todavía.

Esta spec es el desbloqueador de las siguientes fases del roadmap (Dashboard, Históricos, Alarmas): todas ellas se construyen sobre Signals (Documento 3, "Signal como unidad de negocio"), y hoy las únicas Signals que existen son las siete del seed demo. Sin esta spec, cualquier feature posterior tendría que seguir asumiendo datos hardcodeados en vez de configuración real de usuario.

**Alcance explícito respecto al Data Provider**: el único `ProviderType` con una implementación real es `Simulator` ([data-providers/simulation](../../backend/src/interface-adapters/data-providers/simulation)); `ConnectionConfig` hoy solo modela la forma del Simulador (`backend/src/entities/connection-config.vo.ts`). Esta spec **no** introduce el `OpcUaProvider` ni ninguna otra forma de `ConnectionConfig` — eso es la Fase 6 del roadmap, una spec futura. Toda Machine creada aquí sigue recibiendo sus lecturas del Simulador; el CRUD gestiona configuración (qué Machines/Signals existen), no la fuente real del dato.

Esta spec también introduce la variante `FORMULA` de `SignalSource` (hoy `signal-source.vo.ts` solo modela `DIRECT`, con el comentario explícito "FORMULA se añade cuando su spec lo requiera").

## Actor(es)

`User` con rol `AdminCliente` o `SuperAdmin` (Documento 8, apartado 8.6, tabla "Operaciones de Configuración"). Un `AdminCliente` solo opera sobre Machines/Signals de su propia Company; un `SuperAdmin` sobre las de cualquier Company.

## Precondiciones

- El usuario está autenticado con un `accessToken` válido ([05-auth-login.md](05-auth-login.md)).
- La Company del usuario está activa.

## Backend

### Flujo principal (Given/When/Then)

- **Given** un `AdminCliente` autenticado.
- **When** llama a `POST /api/v1/machines` con `{ "name": "..." }`.
- **Then** la API responde `201` con la `Machine` creada (`companyId` tomado del token, nunca del payload) y su `MachineConnection` asociada creada con `providerType: "Simulator"` y un `connectionConfig` por defecto (`{ "seedProfile": "empty", "signals": [] }`).

- **Given** un `AdminCliente` con Machines existentes en su Company.
- **When** llama a `GET /api/v1/machines`.
- **Then** la API responde `200` con la lista paginada de Machines **activas** de su Company (nunca de otra Company), y `GET /api/v1/machines/:id` devuelve el detalle de una de ellas.

- **Given** una Machine existente de la Company del usuario.
- **When** llama a `PATCH /api/v1/machines/:id` con `{ "name": "..." }`.
- **Then** la API responde `200` con la Machine actualizada.

- **Given** una Machine existente con Signals asociadas.
- **When** llama a `DELETE /api/v1/machines/:id`.
- **Then** la API responde `204`, marca la Machine como inactiva (`isActive = false`, baja lógica) y desactiva en cascada todas sus Signals (Documento 3, apartado 3.2.3: "la eliminación de una Machine implicará la eliminación lógica o desactivación de todos los elementos asociados"), sin borrar filas ni histórico ya generado.

- **Given** una Machine existente.
- **When** llama a `GET /api/v1/machines/:machineId/connection`.
- **Then** la API responde `200` con su `MachineConnection` (`providerType`, `connectionConfig`).

- **Given** una Machine con `providerType: "Simulator"`.
- **When** llama a `PUT /api/v1/machines/:machineId/connection` con `{ "providerType": "Simulator", "connectionConfig": { "seedProfile": "...", "signals": [...] } }`.
- **Then** la API responde `200` y reemplaza el `connectionConfig` de la Machine.

- **Given** una Machine existente.
- **When** llama a `POST /api/v1/machines/:machineId/signals` con `{ "name": "...", "signalType": "DIRECT", "signalSource": { "variableName": "..." }, "unit": "..." }`.
- **Then** la API responde `201` con la Signal creada, perteneciente a esa Machine.

- **Given** una Machine existente cuya `MachineConnection.connectionConfig.signals` incluye las variables `temperature` y `pressure`.
- **When** llama a `POST /api/v1/machines/:machineId/signals` con `{ "name": "...", "signalType": "FORMULA", "signalSource": { "expression": "temperature - pressure", "variables": ["temperature", "pressure"] }, "unit": "..." }`.
- **Then** la API responde `201` con la Signal `FORMULA` creada.

- **Given** una Signal existente de una Machine de la Company del usuario.
- **When** llama a `GET /api/v1/machines/:machineId/signals`, `GET .../signals/:id`, `PATCH .../signals/:id` o `DELETE .../signals/:id`.
- **Then** la API lista/devuelve/actualiza/desactiva (baja lógica, igual que Machine) la Signal correspondiente.

### Casos borde / errores (Given/When/Then)

- **Given** una Machine o Signal perteneciente a otra Company.
- **When** un `AdminCliente` intenta `GET`/`PATCH`/`DELETE` sobre ella (por id, adivinando o enumerando).
- **Then** la API responde `404` (nunca `403`, para no confirmar su existencia — OWASP A01, igual criterio que [06-seguridad-global.md](../06-seguridad-global.md) 6.10).

- **Given** un payload de Signal `signalType: "FORMULA"` cuya `variables` incluye un nombre que no aparece en `MachineConnection.connectionConfig.signals` de esa misma Machine.
- **When** se llama a `POST`/`PATCH` de la Signal.
- **Then** la API responde `422` con `code: "FORMULA_REFERENCES_UNKNOWN_VARIABLE"` (Documento 3, apartado 3.2.5: "una Signal FORMULA únicamente puede referenciar Variables de la misma Machine").

- **Given** un payload de `PUT /connection` con `providerType` distinto de `"Simulator"` (p. ej. `"OpcUa"`).
- **When** se llama al endpoint.
- **Then** la API responde `422` con `code: "PROVIDER_NOT_SUPPORTED"` (el `OpcUaProvider` no existe todavía; se habilitará en la spec de integración OPC UA real).

- **Given** una Machine ya inactiva (baja lógica previa).
- **When** se intenta crear una Signal sobre ella, o volver a darla de baja.
- **Then** la API responde `422` con `code: "MACHINE_INACTIVE"`.

- **Given** un payload de `POST`/`PATCH` de Machine o Signal con campos no declarados en el DTO, o con `companyId`/`machineId` incluidos explícitamente en el body.
- **When** se procesa la petición.
- **Then** el `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`) rechaza el payload con `400` (Documento 11, "Validación de payloads" — cierra Mass Assignment, OWASP A04).

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), secciones "Machine", "MachineConnection" y "Signal". Esta spec no implementa `GET .../signals/:id/value` ni `GET .../signals/:id/history` (dependen de la Realtime Cache y de un endpoint de consulta de histórico que no existen todavía — quedan para las specs de Dashboard/Históricos).

### Criterios de aceptación backend

1. `POST /machines` crea una Machine con `companyId` del token (nunca del payload) y una `MachineConnection` con `providerType: "Simulator"` por defecto.
2. `GET /machines` y `GET /machines/:id` solo devuelven Machines activas de la Company del usuario autenticado (`SuperAdmin`: de cualquier Company).
3. `DELETE /machines/:id` es una baja lógica que además desactiva en cascada todas las Signals de esa Machine, sin eliminar filas ni histórico.
4. `PUT /machines/:machineId/connection` con `providerType` distinto de `Simulator` responde `422 PROVIDER_NOT_SUPPORTED`. _(Ampliado por [18-integracion-opc-ua.md](18-integracion-opc-ua.md): desde la spec 18 también se admite `OpcUa`; `Mqtt`/`ModbusTcp` siguen siendo `422`.)_
5. `POST/PATCH` de una Signal `FORMULA` valida que todas las `variables` referenciadas existan en `connectionConfig.signals` de la misma Machine; si no, responde `422 FORMULA_REFERENCES_UNKNOWN_VARIABLE`.
6. Ningún endpoint de este spec permite acceder, ni de solo lectura, a una Machine o Signal de otra Company (responde `404`).
7. Un payload con campos no declarados en el DTO es rechazado con `400` antes de llegar a la capa de aplicación.
8. Operar sobre una Machine ya inactiva responde `422 MACHINE_INACTIVE`.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `AdminCliente` autenticado que navega a la sección "Configuración".
- **When** entra a la pantalla de Machines.
- **Then** ve la lista de Machines de su Company (nombre y estado de conexión básico), con acciones para crear, editar y eliminar.

- **Given** la pantalla de Machines.
- **When** el usuario pulsa "Nueva Machine", completa el formulario (nombre) y confirma.
- **Then** la app llama a `POST /api/v1/machines` y añade la Machine creada a la lista sin recargar la página.

- **Given** el detalle de una Machine.
- **When** el usuario entra a su pestaña "Signals" y pulsa "Nueva Signal", elige tipo `DIRECT` o `FORMULA` y completa el formulario correspondiente.
- **Then** la app llama a `POST .../signals` y añade la Signal a la lista de esa Machine.

- **Given** una Machine o Signal existente.
- **When** el usuario pulsa "Eliminar" y confirma en el diálogo de confirmación.
- **Then** la app llama al `DELETE` correspondiente y retira el elemento de la lista (baja lógica, no se le comunica al usuario como "desactivada" sino simplemente como eliminada de su vista).

### Casos borde / errores de UI

- **Given** un formulario de Signal `FORMULA` que referencia una variable inexistente en la Machine.
- **When** el backend responde `422 FORMULA_REFERENCES_UNKNOWN_VARIABLE`.
- **Then** el formulario muestra el error asociado al campo de variables, sin cerrar el formulario ni perder los datos ya introducidos.

- **Given** un usuario con rol que no tiene permiso de configuración (ninguno definido aún fuera de `AdminCliente`/`SuperAdmin`, pero la regla se deja preparada).
- **When** navega a "Configuración".
- **Then** el Frontend oculta las acciones de creación/edición/borrado si el rol no está autorizado (Documento 8, apartado 8.6, Regla 1) — el Backend las rechaza igualmente si se solicitan directamente.

- **Given** el usuario intenta eliminar una Machine con Signals asociadas.
- **When** confirma el borrado.
- **Then** la UI advierte explícitamente que también se desactivarán sus Signals, antes de confirmar.

### Componentes/pantallas involucrados

Primera implementación real de `frontend/src/app/config/` (hoy carpeta vacía con placeholder, Documento 8 apartado [8.6](../08-frontend-dashboard.md)): listado y formulario de Machines, listado y formulario de Signals (con selector de tipo `DIRECT`/`FORMULA`), diálogo de confirmación de borrado reutilizando el componente compartido existente. No incluye la gestión de `AlarmDefinition` ni `Dashboard` de la misma tabla 8.6 — quedan para sus propias specs.

### Criterios de aceptación frontend

1. La lista de Machines solo muestra las de la Company del usuario y solo las activas.
2. Crear una Machine o Signal actualiza la lista visible sin recargar la página.
3. Un error `422` de validación de negocio (variable desconocida en FORMULA, provider no soportado) se muestra asociado al campo relevante del formulario, no como error genérico.
4. Eliminar una Machine advierte al usuario de que sus Signals también se desactivarán.
5. Las acciones de crear/editar/eliminar están ocultas para roles sin permiso de configuración.
