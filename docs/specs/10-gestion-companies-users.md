# Spec: Gestión de Companies y Users (SuperAdmin)

Feature vertical (Documento 0, "Specs verticales"): cubre backend y frontend juntos.

## Contexto

Hoy la única forma de que exista una `Company` o un `User` es el seed de entorno demo ([01-fundacion-entorno-demo.md](01-fundacion-entorno-demo.md)): nadie puede dar de alta un nuevo cliente ni gestionar sus usuarios desde la plataforma. El Documento 3 (apartados [3.2.1](../03-modelo-de-datos.md) `Company` y 3.2.2 `User`) ya describe estas entidades y su ciclo de vida ("una Company es creada por un SuperAdmin durante el alta de un nuevo cliente"), y el Documento 11 ([11-api-rest.md](../11-api-rest.md), secciones "Company" y "User") ya cataloga su contrato REST, pero ninguno de los dos tiene implementación todavía — solo existen las entidades TypeORM (`backend/src/entities/company.entity.ts`, `user.entity.ts`) y los casos de uso de `auth/` que las leen sin nunca escribirlas.

**Gap de bootstrap detectado al redactar esta spec**: el seed de entorno demo (`seed-demo-environment.config.ts`) solo crea un `User` con rol `AdminCliente` (`demo@ewcontrol.local`); no existe hoy ningún `User` con rol `SuperAdmin` en ningún entorno. Como el alta de una `Company` requiere ya un `SuperAdmin` autenticado, sin ese usuario la funcionalidad de esta spec sería imposible de probar manualmente o mediante e2e. Esta spec extiende el seed de la spec 01 para añadir un segundo usuario demo con rol `SuperAdmin`, igual que la spec 06 extendió `signal-source.vo.ts` con la variante `FORMULA` cuando su spec lo requirió.

**Gap de auto-servicio de contraseña detectado al redactar esta spec**: la tabla de specs pendientes ([README.md](README.md)) señala que el cambio/recuperación de contraseña self-service (Documento 3, apartado 3.2.2: "cambiar su contraseña mediante los servicios de autenticación") no tenía todavía endpoint catalogado en el Documento 11. Esta spec lo añade (`PATCH /api/v1/users/me/password`, `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`) reutilizando el `IEmailSender` ya existente de [04-alarmas](09-alarmas.md) (`backend/src/use-cases/notification/ports/email-sender.port.ts`) para el envío del enlace de recuperación.

## Actor(es)

- `User` con rol `SuperAdmin`: gestiona Companies (cualquiera) y Users (de cualquier Company).
- `User` con rol `AdminCliente`: gestiona Users únicamente de su propia Company; no tiene acceso a la gestión de Companies.
- Cualquier `User` autenticado: cambia su propia contraseña (auto-servicio).
- Actor no autenticado: solicita y completa la recuperación de contraseña (`forgot-password`/`reset-password`).

## Precondiciones

- El actor está autenticado con un `accessToken` válido ([05-auth-login.md](05-auth-login.md)), salvo para `forgot-password`/`reset-password`.
- Para operar sobre `Company`, el rol del token es `SuperAdmin`.
- Para operar sobre `User`, el rol del token es `AdminCliente` o `SuperAdmin`.
- Para `forgot-password`/`reset-password`, no se requiere sesión, pero el `User` destinatario debe existir, estar activo y pertenecer a una Company activa para que el flujo tenga efecto.

## Backend

### Flujo principal (Given/When/Then)

- **Given** un `SuperAdmin` autenticado.
- **When** llama a `POST /api/v1/companies` con `{ "name": "..." }`.
- **Then** la API responde `201` con la `Company` creada (`isActive: true`).

- **Given** un `SuperAdmin` autenticado.
- **When** llama a `GET /api/v1/companies` o `GET /api/v1/companies/:id`.
- **Then** la API responde `200` con la lista paginada de todas las Companies, o el detalle de una de ellas.

- **Given** una Company existente.
- **When** un `SuperAdmin` llama a `PATCH /api/v1/companies/:id` con `{ "name": "..." }`.
- **Then** la API responde `200` con la Company actualizada.

- **Given** una Company existente y activa.
- **When** un `SuperAdmin` llama a `DELETE /api/v1/companies/:id`.
- **Then** la API responde `204` y marca la Company como inactiva (`isActive = false`, baja lógica); ningún `User` de esa Company puede volver a autenticarse ni renovar su sesión ([05-auth-login.md](05-auth-login.md)), sin eliminar filas ni desactivar físicamente sus Users/Machines/Signals (Documento 3, apartado 3.2.1: "impedirá el acceso... sin necesidad de eliminarlos físicamente").

- **Given** una Company existente e inactiva.
- **When** un `SuperAdmin` llama a `POST /api/v1/companies/:id/reactivate`.
- **Then** la API responde `200` con la Company marcada como activa (`isActive = true`), restaurando el acceso a sus Users (Documento 3, apartado 3.2.1). La operación es idempotente: si la Company ya estaba activa, responde `200` sin error.

- **Given** una Company existente (activa o inactiva), con Users, Machines, Signals y Dashboards asociados.
- **When** un `SuperAdmin` llama a `DELETE /api/v1/companies/:id/purge`.
- **Then** la API responde `204` y elimina físicamente, en una única transacción de Postgres: las Signals y MachineConnections de cada Machine, las Machines de la Company, los Users de la Company (los Dashboards se eliminan solos por `ON DELETE CASCADE`) y finalmente la propia Company; tras confirmar la transacción, elimina también el histórico de Signals de esa Company en InfluxDB (predicado por `company_id`, Documento 4 apartado 4.3). La operación es irreversible y no requiere que la Company esté previamente desactivada.

- **Given** un `SuperAdmin` autenticado que acaba de crear una Company.
- **When** llama a `POST /api/v1/users` con `{ "companyId": "<id de la Company>", "email": "...", "password": "...", "role": "AdminCliente" }`.
- **Then** la API responde `201` con el primer `User` de esa Company (así se completa el alta de un nuevo cliente: Company + su AdminCliente inicial).

- **Given** un `AdminCliente` autenticado.
- **When** llama a `POST /api/v1/users` con `{ "email": "...", "password": "...", "role": "AdminCliente" }` (sin `companyId`).
- **Then** la API responde `201` con el `User` creado en la propia Company del requester (`companyId` tomado del token, igual criterio que Machine en [06-gestion-machines-signals.md](06-gestion-machines-signals.md)); si el payload incluye `companyId`, se ignora.

- **Given** un `AdminCliente` o `SuperAdmin` con Users existentes visibles.
- **When** llama a `GET /api/v1/users` o `GET /api/v1/users/:id`.
- **Then** la API responde `200` con **todos** los Users (activos e inactivos) de su Company (`AdminCliente`) o de todas las Companies (`SuperAdmin`), incluyendo `companyId`, `role` e `isActive` en cada uno, nunca `passwordHash` — necesario para poder ver y reactivar Users dados de baja.

- **Given** un User existente en la Company del requester.
- **When** llama a `PATCH /api/v1/users/:id` con `{ "email": "..." }` y/o `{ "role": "..." }`.
- **Then** la API responde `200` con el User actualizado.

- **Given** un User existente en la Company del requester.
- **When** llama a `DELETE /api/v1/users/:id`.
- **Then** la API responde `204`, marca el User como inactivo (`isActive = false`, baja lógica) e invalida inmediatamente todos sus refresh tokens activos (Documento 6, apartado 6.6), sin eliminar la fila.

- **Given** un User existente e inactivo en la Company del requester.
- **When** llama a `POST /api/v1/users/:id/reactivate`.
- **Then** la API responde `200` con el User marcado como activo (`isActive = true`), permitiéndole volver a autenticarse (Documento 3, apartado 3.2.2: "ser reactivado"). La operación es idempotente: si el User ya estaba activo, responde `200` sin error.

- **Given** un User autenticado que conoce su contraseña actual.
- **When** llama a `PATCH /api/v1/users/me/password` con `{ "currentPassword": "...", "newPassword": "..." }`.
- **Then** la API responde `200`, actualiza el hash bcrypt y revoca todos los refresh tokens activos del usuario (fuerza el re-login en el resto de sesiones abiertas, mismo criterio de defensa en profundidad que la reutilización de refresh token en [05-auth-login.md](05-auth-login.md)), registrando el evento en el log de auditoría.

- **Given** un email de un `User` activo, en una Company activa.
- **When** un actor no autenticado llama a `POST /api/v1/auth/forgot-password` con `{ "email": "..." }`.
- **Then** la API responde `202` (siempre, ver casos borde) y envía por email (vía `IEmailSender`) un enlace con un token de recuperación de un solo uso, válido durante 1 hora.

- **Given** un token de recuperación válido, no usado y no expirado.
- **When** se llama a `POST /api/v1/auth/reset-password` con `{ "token": "...", "newPassword": "..." }`.
- **Then** la API responde `200`, actualiza el hash de la contraseña, invalida el token (un solo uso), revoca todos los refresh tokens activos del usuario y registra el evento en el log de auditoría.

### Casos borde / errores (Given/When/Then)

- **Given** un `AdminCliente` autenticado.
- **When** llama a cualquier endpoint de `/api/v1/companies`.
- **Then** la API responde `403` (el rol en sí no tiene permiso sobre esta funcionalidad, a diferencia del `404` por aislamiento entre Companies que usan Machine/Signal — aquí no hay ninguna Company "propia" sobre la que degradar el acceso).

- **Given** un User o Company perteneciente a otra Company (para el caso de User) o inexistente.
- **When** un `AdminCliente` intenta `GET`/`PATCH`/`DELETE` sobre un User de otra Company (por id, adivinando o enumerando).
- **Then** la API responde `404` (nunca `403`, mismo criterio que [06-gestion-machines-signals.md](06-gestion-machines-signals.md) y [06-seguridad-global.md](../06-seguridad-global.md) 6.10).

- **Given** un `AdminCliente` autenticado.
- **When** llama a `POST /api/v1/users` o `PATCH /api/v1/users/:id` con `role: "SuperAdmin"`.
- **Then** la API responde `403` (un `AdminCliente` nunca puede crear ni ascender a un `SuperAdmin`).

- **Given** un payload de `POST /api/v1/users` o `POST /api/v1/companies` con un `email`/`name` que ya existe.
- **When** se procesa la petición.
- **Then** la API responde `409` con `code: "EMAIL_ALREADY_EXISTS"` (el email de `User` es único en toda la plataforma, no solo por Company).

- **Given** un User que intenta darse de baja a sí mismo.
- **When** llama a `DELETE /api/v1/users/:id` con su propio id.
- **Then** la API responde `422` con `code: "CANNOT_DEACTIVATE_SELF"` (evita que un administrador se bloquee su propio acceso sin que otro usuario pueda revertirlo).

- **Given** un `PATCH /api/v1/users/me/password` con `currentPassword` incorrecta.
- **When** se procesa la petición.
- **Then** la API responde `422` con `code: "CURRENT_PASSWORD_INVALID"` (el usuario ya está autenticado, por lo que no aplica `401`; es una validación de negocio, Documento 11 tabla de status).

- **Given** un `newPassword` en `PATCH /users/me/password`, `POST /auth/reset-password` o `POST /users` que no cumple la política mínima (≥ 8 caracteres, al menos una letra y un número).
- **When** se procesa la petición.
- **Then** el `ValidationPipe` global responde `400` con `details` indicando la regla incumplida (mismo mecanismo que cualquier otro DTO, Documento 11 "Validación de payloads").

- **Given** un email inexistente, un User inactivo o una Company inactiva.
- **When** se llama a `POST /api/v1/auth/forgot-password` con ese email.
- **Then** la API responde `202` igualmente y no envía ningún email (evita enumeración de usuarios, mismo criterio que `INVALID_CREDENTIALS` en [05-auth-login.md](05-auth-login.md), OWASP A07).

- **Given** más de 3 solicitudes de `forgot-password` para el mismo email en 15 minutos.
- **When** se produce una nueva solicitud.
- **Then** la API responde `429 TOO_MANY_REQUESTS`, igual para emails existentes e inexistentes (el contador se lleva por email solicitado, no por si existe, para no diferenciar la respuesta — mismo mecanismo de auditoría que el rate limiting de login, Documento 6 apartado 6.2).

- **Given** un token de recuperación ya usado, expirado, o que no corresponde a ningún User.
- **When** se llama a `POST /api/v1/auth/reset-password` con ese token.
- **Then** la API responde `401` con `code: "INVALID_RESET_TOKEN"`.

- **Given** un payload de `POST`/`PATCH` de Company o User con campos no declarados en el DTO.
- **When** se procesa la petición.
- **Then** el `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`) rechaza el payload con `400` (cierra Mass Assignment, OWASP A04).

- **Given** una Company o un User inexistente.
- **When** se llama a `POST /api/v1/companies/:id/reactivate`, `DELETE /api/v1/companies/:id/purge` o `POST /api/v1/users/:id/reactivate` con un `id` que no existe.
- **Then** la API responde `404`.

- **Given** `DELETE /api/v1/companies/:id/purge`.
- **When** se procesa la petición.
- **Then** el control de autorización es exclusivamente `RolesGuard` (rol `SuperAdmin`), igual que el resto de endpoints de Company; la API **no** valida en el servidor ningún nombre de Company tecleado por el cliente — esa confirmación es fricción de UI contra el clic accidental (OWASP A04, Documento 6 apartado 6.10), no un control de autorización, y su ausencia u omisión en el payload no afecta al resultado de la operación.

- **Given** el borrado físico de una Company vía `purge`.
- **When** se completa con éxito.
- **Then** no se genera ninguna entrada de auditoría específica (el `auth_audit_log` existente cubre solo autenticación, OWASP A09, Documento 6 apartado 6.10) — mismo alcance que el resto de bajas lógicas de esta spec, que tampoco se auditan hoy; queda como mejora futura fuera de alcance.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), secciones "Auth" (`forgot-password`, `reset-password`), "Company" y "User" (incluyendo `PATCH /api/v1/users/me/password`).

### Criterios de aceptación backend

1. `POST /companies`, `GET /companies`, `GET /companies/:id`, `PATCH /companies/:id`, `DELETE /companies/:id`, `POST /companies/:id/reactivate` y `DELETE /companies/:id/purge` solo son accesibles con rol `SuperAdmin`; cualquier otro rol recibe `403`.
2. `DELETE /companies/:id` es una baja lógica que bloquea el login/refresh de todos los Users de esa Company sin eliminar ni desactivar físicamente filas asociadas.
3. `POST /users` toma el `companyId` del token para un `AdminCliente` (ignorando cualquier `companyId` del payload) y requiere `companyId` explícito en el payload para un `SuperAdmin`.
4. Ningún `AdminCliente` puede crear, ascender, ver ni modificar un `User` con rol `SuperAdmin`, ni acceder a Users de otra Company (`404`).
5. `DELETE /users/:id` es una baja lógica que invalida inmediatamente todos los refresh tokens activos de ese User.
6. Un User no puede desactivarse a sí mismo (`422 CANNOT_DEACTIVATE_SELF`).
7. `PATCH /users/me/password` requiere `currentPassword` correcta, actualiza el hash con bcrypt y revoca todos los refresh tokens activos del usuario.
8. `forgot-password` responde siempre `202` (exista o no el email, esté activo o no) y solo envía email cuando el User y su Company están activos; más de 3 solicitudes por email en 15 minutos responden `429`.
9. `reset-password` con un token válido, no usado y no expirado dentro de 1 hora desde su emisión actualiza la contraseña, invalida el token y revoca todos los refresh tokens activos; cualquier otro caso responde `401 INVALID_RESET_TOKEN`.
10. El email de `User` es único en toda la plataforma; un duplicado responde `409 EMAIL_ALREADY_EXISTS`.
11. Toda nueva contraseña (creación de User, cambio propio o recuperación) exige mínimo 8 caracteres con al menos una letra y un número, validado por DTO (`400` si no cumple).
12. El seed de entorno demo ([01-fundacion-entorno-demo.md](01-fundacion-entorno-demo.md)) incluye un segundo User demo con rol `SuperAdmin`, permitiendo probar esta spec de extremo a extremo sin acceso directo a la base de datos.
13. `GET /users`/`GET /users/:id` devuelven Users activos e inactivos (nunca ocultan los dados de baja, para poder reactivarlos).
14. `POST /companies/:id/reactivate` y `POST /users/:id/reactivate` son idempotentes (no fallan si el recurso ya estaba activo) y no dependen de ningún estado previo del recurso.
15. `DELETE /companies/:id/purge` elimina físicamente la Company y todos sus recursos asociados (Users, Machines, MachineConnections, Signals; Dashboards vía `ON DELETE CASCADE`) en Postgres, y su histórico de Signals en InfluxDB; puede ejecutarse tanto sobre una Company activa como inactiva; un fallo al borrar el histórico de InfluxDB se registra pero no revierte ni bloquea el borrado ya confirmado en Postgres.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `SuperAdmin` autenticado que navega a la sección "Configuración".
- **When** entra a la nueva pantalla "Companies" (solo visible para su rol).
- **Then** ve la lista de todas las Companies (nombre, estado), con acciones para crear, editar y dar de baja.

- **Given** la pantalla de Companies.
- **When** el `SuperAdmin` pulsa "Nueva Company", completa el nombre y confirma.
- **Then** la app llama a `POST /api/v1/companies`, añade la Company a la lista y ofrece continuar directamente al alta de su primer User (`AdminCliente`) sobre esa Company recién creada.

- **Given** la lista de Companies.
- **When** el `SuperAdmin` pulsa "Reactivar" sobre una Company inactiva.
- **Then** la app llama a `POST /api/v1/companies/:id/reactivate`, actualiza el estado de la fila a "Activa" y muestra un toast de confirmación, sin diálogo de confirmación adicional (acción reversible, no destructiva).

- **Given** la lista de Companies.
- **When** el `SuperAdmin` pulsa "Eliminar permanentemente" sobre una Company (activa o inactiva).
- **Then** la app abre un diálogo que advierte explícitamente que se perderán la Company, sus Users, Machines, Signals y Dashboards de forma irreversible, y exige teclear el nombre exacto de la Company para habilitar el botón de confirmar; al confirmar, llama a `DELETE /api/v1/companies/:id/purge` y quita la Company de la lista.

- **Given** un `AdminCliente` o `SuperAdmin` autenticado que entra a la pantalla "Users" de Configuración.
- **When** el `SuperAdmin` ha seleccionado previamente una Company (Documento 8, apartado 8.8, "Experiencia del SuperAdmin"), o el `AdminCliente` entra directamente.
- **Then** ve la lista de Users de esa Company (email, rol, estado), con acciones para crear, editar, dar de baja y reactivar; un `AdminCliente` nunca ve el selector de Company.

- **Given** la lista de Users.
- **When** el usuario con permisos pulsa "Reactivar" sobre un User inactivo.
- **Then** la app llama a `POST /api/v1/users/:id/reactivate`, actualiza el estado de la fila a "Activo" y muestra un toast de confirmación, sin diálogo de confirmación adicional.

- **Given** la pantalla de Users.
- **When** el usuario pulsa "Nuevo User", completa email/contraseña/rol y confirma.
- **Then** la app llama a `POST /api/v1/users` y añade el User a la lista sin recargar la página; el selector de rol solo ofrece `SuperAdmin` cuando el requester ya es `SuperAdmin`; si el requester es `SuperAdmin`, el formulario incluye además un selector "Company" obligatorio (ausente para `AdminCliente` y en modo edición), pre-rellenado con la Company seleccionada previamente en el switcher de la lista si la hay.

- **Given** un usuario autenticado que abre su menú de cuenta.
- **When** entra a "Cambiar contraseña" e introduce su contraseña actual y la nueva.
- **Then** la app llama a `PATCH /api/v1/users/me/password`, muestra confirmación y, si la sesión sigue viva (el `accessToken` en memoria no se invalida a sí mismo), no fuerza logout inmediato en la propia pestaña.

- **Given** la pantalla de login.
- **When** el usuario pulsa "¿Olvidaste tu contraseña?", introduce su email y confirma.
- **Then** la app llama a `POST /api/v1/auth/forgot-password` y muestra siempre el mismo mensaje de confirmación genérico, exista o no la cuenta.

- **Given** un enlace de recuperación recibido por email (`/reset-password?token=...`).
- **When** el usuario abre el enlace, introduce una nueva contraseña y confirma.
- **Then** la app llama a `POST /api/v1/auth/reset-password` y, si la API responde `200`, redirige a login con un mensaje de éxito.

### Casos borde / errores de UI

- **Given** un `AdminCliente` autenticado.
- **When** intenta navegar directamente a la URL de la pantalla de Companies.
- **Then** el guard de rutas lo redirige (el Backend rechazaría la petición igualmente con `403`, Documento 8 apartado 8.6 Regla 1).

- **Given** un `SuperAdmin` autenticado que navega directamente a la URL de alta de User (`/config/users/new`) sin haber seleccionado antes una Company en el switcher de la lista.
- **When** entra al formulario.
- **Then** el selector "Company" aparece vacío y obligatorio; el formulario no permite guardar hasta elegir una, evitando depender de haber navegado antes por la lista (no se asume ningún contexto de Company implícito).

- **Given** el formulario de "Cambiar contraseña".
- **When** el backend responde `422 CURRENT_PASSWORD_INVALID`.
- **Then** el error se muestra asociado al campo "Contraseña actual", sin perder el resto de datos introducidos.

- **Given** el formulario de "Nuevo User" o "Cambiar contraseña".
- **When** el backend responde `400` por incumplir la política de contraseña.
- **Then** el error se muestra asociado al campo de nueva contraseña, con el requisito exacto (mínimo 8 caracteres, letra y número).

- **Given** el formulario de recuperación de contraseña vía token.
- **When** el backend responde `401 INVALID_RESET_TOKEN`.
- **Then** se muestra un mensaje indicando que el enlace ya no es válido y un acceso para solicitar uno nuevo.

- **Given** el formulario de "¿Olvidaste tu contraseña?".
- **When** el backend responde `429 TOO_MANY_REQUESTS`.
- **Then** se muestra un mensaje indicando que se ha superado el número de solicitudes y debe esperar, en vez del mensaje de confirmación genérico (mismo criterio que el login, spec 05; no viola la protección anti-enumeración porque el contador del `429` ya se lleva por email solicitado con independencia de si la cuenta existe, ver más arriba, backend).

- **Given** un intento de dar de baja el propio usuario desde la pantalla de Users.
- **When** el backend responde `422 CANNOT_DEACTIVATE_SELF`.
- **Then** la acción "Eliminar" para la propia fila aparece deshabilitada de antemano en la UI, con un tooltip explicativo, en vez de esperar al error del Backend.

### Componentes/pantallas involucrados

Extiende `frontend/src/app/config/` ([06-gestion-machines-signals.md](06-gestion-machines-signals.md)) con el listado y formulario de Companies (solo `SuperAdmin`) y el listado y formulario de Users; extiende `config-permissions.ts` (hoy un único `canConfigure()` binario) para distinguir permisos específicos de Company (`SuperAdmin` únicamente) frente a los de User (`AdminCliente`/`SuperAdmin`). Añade a `frontend/src/app/auth/` las pantallas de cambio de contraseña (autenticado), "¿Olvidaste tu contraseña?" y "Restablecer contraseña" (no autenticadas), junto al enlace correspondiente en `login-page`. Extiende `frontend/src/app/shared/ui/confirm-dialog/` (hoy Sí/No puro) con un modo "escribe el nombre para confirmar", reutilizado por la acción "Eliminar permanentemente" de Company.

### Criterios de aceptación frontend

1. La pantalla de Companies solo es accesible y visible para `SuperAdmin`.
2. La pantalla de Users respeta el contexto de Company activo (selector para `SuperAdmin`, implícito para `AdminCliente`) y no mezcla Users de distintas Companies en una misma vista (Documento 8, apartado 8.8, Regla 1).
3. El selector de rol al crear/editar un User solo ofrece `SuperAdmin` cuando el requester ya tiene ese rol.
4. Un error `422`/`400` de validación de negocio se muestra asociado al campo relevante del formulario, no como error genérico.
5. La acción de deshabilitar/eliminar la propia fila de usuario está deshabilitada preventivamente en la UI.
6. El flujo de recuperación de contraseña muestra siempre el mismo mensaje de confirmación tras `forgot-password`, exista o no la cuenta.
7. Un `429` en `forgot-password` muestra un mensaje de límite de solicitudes, distinto del mensaje de confirmación genérico (criterio 6).
8. "Reactivar" (Company y User) es una acción directa sin diálogo de confirmación, visible únicamente cuando el recurso está inactivo.
9. "Eliminar permanentemente" (Company) exige teclear el nombre exacto de la Company para habilitar el botón de confirmar, y el diálogo advierte explícitamente qué se pierde (Users, Machines, Signals, Dashboards) y que la acción es irreversible; está visible tanto si la Company está activa como inactiva.
10. El formulario de alta de User exige un selector de Company obligatorio cuando el requester es `SuperAdmin` (ausente para `AdminCliente` y en modo edición); no depende de ningún contexto de navegación previo (funciona igual entrando directamente a la URL de alta que llegando desde el switcher de la lista, que solo lo pre-rellena).
