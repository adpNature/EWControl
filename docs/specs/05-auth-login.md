# Spec: Autenticación de usuario (login)

Primera feature vertical del proyecto: cubre backend y frontend juntos (Documento 0, "Specs verticales").

## Contexto

Ningún usuario puede acceder a ningún otro endpoint de la API sin autenticarse antes (Documento 11, "Convenciones Globales — Autenticación"). El esquema de JWT access+refresh y su justificación de seguridad están detallados en [06-seguridad-global.md](../06-seguridad-global.md).

## Actor(es)

Cualquier `User` (rol `SuperAdmin` o `AdminCliente`, Documento 3 apartado 3.2.2).

## Precondiciones

- Existe un `User` activo con email y contraseña (hash) almacenados.
- El `User` pertenece a una `Company` activa (una Company dada de baja no permite login a sus usuarios).

## Backend

### Flujo principal (Given/When/Then)

- **Given** un usuario `demo@ewcontrol.local` con contraseña `Demo1234!` activo en una Company activa.
- **When** se llama a `POST /api/v1/auth/login` con `{ "email": "demo@ewcontrol.local", "password": "Demo1234!" }`.
- **Then** la API responde `200` con `{ "accessToken": "<jwt>", "user": { "id", "email", "role", "companyId" } }`, y establece el `refreshToken` en una cookie `httpOnly`, `Secure`, `SameSite=Strict`. El `accessToken` expira en 15 minutos; el `refreshToken` en 7 días.

- **Given** un `accessToken` expirado y un `refreshToken` todavía válido.
- **When** se llama a `POST /api/v1/auth/refresh` (la cookie se envía automáticamente).
- **Then** la API responde `200` con un nuevo `accessToken`, y rota el `refreshToken` (el anterior queda invalidado, se emite uno nuevo en la cookie).

- **Given** una sesión activa.
- **When** se llama a `POST /api/v1/auth/logout`.
- **Then** el `refreshToken` actual se invalida en el backend y se borra la cookie.

### Casos borde / errores (Given/When/Then)

- **Given** un email inexistente o una contraseña incorrecta.
- **When** se llama a `login`.
- **Then** la API responde `401` con `code: "INVALID_CREDENTIALS"`, sin indicar si el fallo fue el email o la contraseña (evita enumeración de usuarios, OWASP A07).

- **Given** un `refreshToken` ya usado previamente (reutilización tras rotación).
- **When** se llama a `refresh` con ese token.
- **Then** la API responde `401`, invalida **todos** los refresh tokens activos de ese usuario (posible robo de token) y registra el evento en el log de auditoría (Documento 6, apartado 6.6).

- **Given** un `User` desactivado o su `Company` dada de baja.
- **When** intenta hacer `login` o `refresh`.
- **Then** la API responde `401`, independientemente de si la contraseña era correcta.

- **Given** más de 5 intentos fallidos de `login` para el mismo email en 15 minutos.
- **When** se produce un nuevo intento.
- **Then** la API responde `429 TOO_MANY_REQUESTS` (rate limiting, mitigación de fuerza bruta, OWASP A07).

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección "Auth".

### Criterios de aceptación backend

1. Un login válido devuelve `accessToken` (15 min) y establece `refreshToken` (7 días) en cookie `httpOnly`/`Secure`/`SameSite=Strict`.
2. Un login con credenciales inválidas responde `401` con el mismo mensaje genérico, sin filtrar si el email existe.
3. `refresh` rota el `refreshToken` y el anterior deja de ser válido.
4. Reutilizar un `refreshToken` ya rotado invalida toda la sesión del usuario.
5. `logout` invalida el `refreshToken` actual.
6. Desactivar un `User` o su `Company` invalida sus sesiones inmediatamente.
7. Más de 5 intentos fallidos de login en 15 minutos bloquean temporalmente ese email.
8. Las contraseñas se almacenan con un hash con salt mediante **bcrypt** (comparativa frente a Argon2id y motivo de la elección en [06-seguridad-global.md](../06-seguridad-global.md), apartado 6.2), nunca en texto plano (OWASP A02).

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un usuario no autenticado que navega a cualquier ruta protegida.
- **When** carga la aplicación.
- **Then** un guard de rutas lo redirige a la pantalla de login.

- **Given** la pantalla de login.
- **When** el usuario introduce email y contraseña y pulsa "Entrar".
- **Then** la app llama a `POST /api/v1/auth/login`, guarda el `accessToken` únicamente en memoria (no en `localStorage`/`sessionStorage`, para reducir exposición ante XSS, OWASP A03), y navega al Dashboard.

- **Given** un `accessToken` en memoria que expira mientras el usuario navega.
- **When** una petición HTTP responde `401`.
- **Then** la app intenta automáticamente `POST /api/v1/auth/refresh` (la cookie de refresh viaja sola) y reintenta la petición original una vez; si el refresh también falla, redirige a login.

### Casos borde / errores de UI

- **Given** credenciales incorrectas.
- **When** el backend responde `401 INVALID_CREDENTIALS`.
- **Then** se muestra un único mensaje genérico ("Email o contraseña incorrectos"), sin distinguir cuál fue el campo erróneo.

- **Given** el backend responde `429 TOO_MANY_REQUESTS`.
- **Then** se muestra un mensaje indicando que se ha superado el número de intentos y debe esperar.

- **Given** el usuario recarga la página (F5) con una sesión activa.
- **When** se inicializa la app.
- **Then** se intenta un `refresh` silencioso contra la cookie antes de decidir si redirigir a login, para no perder la sesión al recargar (el `accessToken` en memoria no sobrevive a un refresh de página).

### Componentes/pantallas involucrados

Pantalla de login, guard de rutas, interceptor HTTP de autenticación/refresh. Alineado con la arquitectura Angular descrita en [08-frontend-dashboard.md](../08-frontend-dashboard.md).

### Criterios de aceptación frontend

1. Ninguna ruta protegida es accesible sin sesión activa.
2. El `accessToken` nunca se persiste en `localStorage`/`sessionStorage`.
3. Un `401` en cualquier petición dispara un intento automático de refresh antes de forzar logout.
4. Recargar la página no cierra la sesión si el `refreshToken` sigue siendo válido.
5. Los mensajes de error de login no distinguen email inexistente de contraseña incorrecta.
