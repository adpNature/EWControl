# Spec: Rol Operador

## Contexto

Primera de las dos specs que permiten **escribir en la máquina** desde EWControl. La segunda, [20-paquetes-escritura-opc-ua.md](20-paquetes-escritura-opc-ua.md), añade las variables escribibles, los "paquetes" de escritura (recetas cerradas con valores fijos) y su ejecución contra el PLC.

El reparto de funciones acordado es:

- `AdminCliente` y `SuperAdmin` **configuran**: deciden qué variables se pueden escribir y montan los paquetes.
- Un rol nuevo, **`Operador`**, **opera**: ve la planta (Dashboard, Históricos, Alarmas), reconoce alarmas y ejecuta paquetes, pero no puede configurar nada.

Esta spec introduce solo el rol `Operador`, sin escritura todavía. [03-modelo-de-datos.md](../03-modelo-de-datos.md) (apartado 3.5, "Evoluciones futuras") ya preveía "Operador" como rol futuro.

**Problema de partida.** Hoy casi ningún endpoint comprueba el rol: solo `companies` lleva `@roles(SuperAdmin)`. El resto (Machines, Signals, conexiones, reglas de alarma, Dashboards, Users) está abierto a cualquier usuario autenticado y solo se acota por Company. Con dos roles que podían configurarlo todo no hacía falta más. Con el Operador, **toda operación de configuración debe exigir rol**, en el Backend (autoridad final) y en el Frontend (ocultar lo que no se puede hacer), como ya prevé [08-frontend-dashboard.md](../08-frontend-dashboard.md) §8.6, Reglas 1 y 2.

## Actor(es)

- `AdminCliente` (en su Company) y `SuperAdmin` (en cualquiera): dan de alta, editan y desactivan Users con rol `Operador`.
- `Operador`: User de una Company concreta, igual que un `AdminCliente`, pero sin permisos de configuración.

## Precondiciones

- Las specs [05-auth-login.md](05-auth-login.md) y [10-gestion-companies-users.md](10-gestion-companies-users.md) están implementadas: login con JWT y gestión de Users.
- El rol viaja en el access token y lo comprueban `JwtAuthGuard` + `RolesGuard` (los dos `APP_GUARD` globales).

## Matriz de permisos

| Recurso / operación                                                          | SuperAdmin | AdminCliente    | Operador                                   |
| ---------------------------------------------------------------------------- | ---------- | --------------- | ------------------------------------------ |
| Login, refresh, logout, recuperar contraseña, cambiar la propia contraseña   | ✅         | ✅              | ✅                                         |
| Ver Dashboards, widgets y valores en tiempo real (REST y WebSocket)          | ✅ (todas) | ✅ (su Company) | ✅ (su Company)                            |
| Ver Machines y Signals (`GET`)                                               | ✅         | ✅              | ✅ (necesario para Dashboard e Históricos) |
| Ver Históricos (por Signal y comparativas)                                   | ✅         | ✅              | ✅                                         |
| Ver estados de alarma y reglas de alarma (`GET`)                             | ✅         | ✅              | ✅                                         |
| Reconocer (ACK) una alarma                                                   | ✅         | ✅              | ✅                                         |
| Crear/editar/borrar Machines, Signals y reglas de alarma                     | ✅         | ✅              | ❌ `403`                                   |
| Ver o cambiar la conexión de una Machine (incluye prueba/exploración OPC UA) | ✅         | ✅              | ❌ `403`                                   |
| Control del Simulador (forzar desconexión/calidad, sembrar histórico)        | ✅         | ✅              | ❌ `403`                                   |
| Crear/editar/borrar Dashboards y widgets                                     | ✅         | ✅              | ❌ `403`                                   |
| Ver y gestionar Users (salvo la propia contraseña)                           | ✅         | ✅              | ❌ `403`                                   |
| Gestionar Companies                                                          | ✅         | ❌ `403`        | ❌ `403`                                   |
| Ejecutar paquetes de escritura                                               | ✅         | ✅              | ✅ (spec 20)                               |

La denegación por rol responde `403 FORBIDDEN` (el `RolesGuard` existente), no `404`. El `404` sigue reservado para recursos de otra Company (OWASP A01, [06-seguridad-global.md](../06-seguridad-global.md) §6.10): el rol no revela la existencia de ningún recurso concreto.

## Backend

### Flujo principal (Given/When/Then)

- **Given** un `AdminCliente` autenticado.
- **When** llama a `POST /api/v1/users` con `{ "email": "...", "password": "...", "role": "Operador" }`.
- **Then** la API responde `201` con el User creado en la Company del `AdminCliente` (nunca en otra), igual que un `AdminCliente` nuevo.

- **Given** un `SuperAdmin` autenticado.
- **When** crea un User `Operador` indicando `companyId`.
- **Then** el User queda en esa Company.

- **Given** un `Operador` activo.
- **When** hace login.
- **Then** recibe un access token con `role: "Operador"` y su `companyId`, igual que el resto de roles.

- **Given** un `Operador` autenticado.
- **When** llama a cualquier endpoint de lectura de la matriz (Dashboards, Machines, Signals, valores, Históricos, alarmas) o hace ACK de una alarma de su Company.
- **Then** la API responde como para un `AdminCliente` de su misma Company, con el mismo filtrado por `companyId`.

- **Given** un `Operador` autenticado conectado al WebSocket.
- **When** se produce un `SignalUpdated` o un evento de alarma en su Company.
- **Then** lo recibe en la sala `company:<id>`, igual que el resto de roles de esa Company.

### Casos borde / errores (Given/When/Then)

- **Given** un `Operador` autenticado.
- **When** llama a cualquier endpoint marcado ❌ en la matriz, aunque el recurso sea de su Company.
- **Then** la API responde `403 FORBIDDEN` y no se ejecuta el caso de uso.

- **Given** un `Operador` autenticado.
- **When** llama a `PATCH /api/v1/users/me/password`.
- **Then** puede cambiar su propia contraseña: es la única ruta de `/users` permitida a un `Operador`.

- **Given** un `AdminCliente`.
- **When** intenta crear o editar un User con rol `SuperAdmin`.
- **Then** sigue respondiendo `403`, como hasta ahora (spec 10). Crear o editar un `Operador` sí está permitido.

- **Given** un `AdminCliente` que edita un User existente.
- **When** cambia su rol entre `AdminCliente` y `Operador`.
- **Then** el cambio se aplica. Los refresh tokens del User se revocan, para que el rol nuevo se aplique en el siguiente login y no tarde hasta 7 días en tener efecto.

- **Given** un payload de `POST`/`PATCH /users` con un `role` que no es `SuperAdmin`, `AdminCliente` ni `Operador`.
- **When** se procesa.
- **Then** la API responde `400`, por la validación del DTO.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md). No hay endpoints nuevos: `UserRole` admite el valor `"Operador"` en `POST /users`, `PATCH /users/:id` y en el access token. La columna `users.role` es `varchar`, así que no hace falta migración.

El seed de entorno demo ([01-fundacion-entorno-demo.md](01-fundacion-entorno-demo.md)) añade un tercer User para poder probar el rol: `operador@ewcontrol.local`, en la Company demo.

### Criterios de aceptación backend

1. `UserRole` incluye `Operador`. `POST/PATCH /users` lo aceptan con las mismas reglas de Company que `AdminCliente`, y cualquier otro valor da `400`.
2. Un `Operador` hace login y recibe un token con `role: "Operador"`.
3. Un `Operador` recibe `403` en **todos** los endpoints marcados ❌ en la matriz. Un test recorre la lista completa de rutas de escritura y verifica el `403` en cada una.
4. Un `Operador` accede a todos los endpoints marcados ✅ con el mismo filtrado por Company que un `AdminCliente`, incluido el ACK de alarmas.
5. Un `Operador` puede cambiar su propia contraseña (`PATCH /users/me/password`).
6. Cambiar el rol de un User revoca sus refresh tokens activos.
7. Los permisos de `AdminCliente` y `SuperAdmin` no cambian: los tests de las specs anteriores siguen en verde.
8. El seed demo crea además el User `operador@ewcontrol.local` con rol `Operador` en la Company demo.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `AdminCliente` en el formulario de nuevo User.
- **When** despliega el selector de rol.
- **Then** puede elegir `AdminCliente` u `Operador`, con un texto de ayuda que explica qué puede hacer cada uno. Un `SuperAdmin` ve además `SuperAdmin`.

- **Given** un `Operador` que inicia sesión.
- **When** se carga el Shell.
- **Then** la barra lateral muestra Dashboard, Alarmas, Históricos y Cuenta, pero **no** Configuración.

- **Given** un `Operador` en un Dashboard.
- **When** lo visualiza.
- **Then** ve los widgets con sus valores en tiempo real, pero no los controles de crear, editar o borrar Dashboards y widgets.

- **Given** un `Operador` en la pantalla de Alarmas.
- **When** pulsa "Reconocer" en una alarma activa.
- **Then** la alarma se reconoce, igual que para un `AdminCliente`.

### Casos borde / errores de UI

- **Given** un `Operador`.
- **When** navega directamente por URL a cualquier ruta bajo `/config` (p. ej. `/config/machines`).
- **Then** el Frontend le redirige al Dashboard sin llegar a cargar la página, mediante un guard de ruta. El Backend lo rechazaría igualmente con `403`.

- **Given** un `Operador` cuya sesión tiene una pantalla abierta de antes de un cambio de rol.
- **When** una acción devuelve `403`.
- **Then** se muestra un toast "No tienes permiso para realizar esta acción", sin cerrar la sesión.

- **Given** la lista de Users.
- **When** se carga.
- **Then** la columna de rol muestra `Operador` para esos Users.

### Componentes/pantallas involucrados

Referencia: [08-frontend-dashboard.md](../08-frontend-dashboard.md) §8.6.

- `auth/entities/user.model.ts`: `UserRole` incluye `'Operador'`.
- `config/use-cases/config-permissions.ts`: `canConfigure`/`canManageUsers` siguen excluyendo al `Operador` (ya están preparadas para ello); nuevo `canAccessConfig`.
- Nuevo guard de ruta `configGuard` para todo `/config`, junto al `superAdminGuard` ya existente.
- Shell / barra lateral: el ítem "Configuración" depende de `canAccessConfig`.
- Dashboard: los controles de edición dependen de `canConfigure`.
- `config/pages/user-form-page`: opción `Operador` en el selector de rol, con su texto de ayuda.

### Criterios de aceptación frontend

1. El selector de rol del formulario de User ofrece `Operador` (y `SuperAdmin` solo a un `SuperAdmin`).
2. Con rol `Operador`, la barra lateral no muestra "Configuración".
3. Con rol `Operador`, cualquier ruta `/config/**` redirige al Dashboard.
4. Con rol `Operador`, el Dashboard no muestra controles de crear, editar ni borrar.
5. Con rol `Operador`, Alarmas permite el ACK y Históricos funciona igual que para un `AdminCliente`.
6. Un `403` de la API muestra un toast de falta de permiso, sin cerrar la sesión.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

- **A01 Control de acceso**: es el núcleo de esta spec. El rol se comprueba siempre en el Backend (`RolesGuard`), y el Frontend solo oculta. Un test por cada ruta de escritura evita que una ruta nueva quede abierta al `Operador` por olvido.
- **A04 Diseño inseguro**: si una ruta de configuración nueva se añade sin `@roles`, el test de la matriz (criterio 3) debe fallar. Para ello, la lista de rutas restringidas se obtiene de los controllers, no se escribe a mano.
- **A07**: cambiar el rol de un User revoca sus refresh tokens, para que un rol degradado no conserve privilegios durante la vida del token.

## Fuera de alcance

- Las variables escribibles, los paquetes y la escritura en el PLC: [20-paquetes-escritura-opc-ua.md](20-paquetes-escritura-opc-ua.md).
- Los avisos de alarma por email: siguen yendo solo a los `AdminCliente` de la Company. Avisar también al `Operador` queda para una spec posterior.
- Otros roles previstos en el documento 3 (Técnico de mantenimiento, Supervisor, Solo lectura).
