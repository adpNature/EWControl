# Spec: Landing page pública (bienvenida)

Feature vertical (Documento 0, "Specs verticales") sin parte de Backend: no introduce ningún
endpoint, entidad ni caso de uso nuevo — es puramente de presentación y routing del Frontend.
Se omite la sección Backend de la plantilla.

## Contexto

Hoy no existe ninguna pantalla pública orientada a explicar la plataforma. El path raíz `''`
de `frontend/src/app/app.routes.ts` está ocupado por el shell privado (`AppShellComponent`),
protegido por `authGuard` (`frontend/src/app/core/guards/auth.guard.ts`): un visitante anónimo
que entra a `/` termina redirigido a `/login` sin ver nada de la plataforma antes de
autenticarse. Se necesita una landing de bienvenida en `/` que explique, en lenguaje llano y sin
tecnicismos, qué es EWControl y por qué elegirlo, con una cabecera fija (sticky) con navegación
por scroll a las distintas secciones y un único punto de entrada a la aplicación ("Iniciar
sesión").

Reutiliza la identidad de marca ya cerrada en la spec 16
([16-pulido-visual-frontend.md](16-pulido-visual-frontend.md)): logo
`gfx/logoEnergyWinders.png`, paleta y tipografía de `docs/12-convenciones-frontend.md` §12.3, sin
introducir ningún color, tipografía o icono nuevo.

**Sin alta self-service**: las `Company`/`User` las crea un `SuperAdmin`
([10-gestion-companies-users.md](10-gestion-companies-users.md)) — esta landing no incluye
ningún enlace ni CTA de "registro", solo de "Iniciar sesión".

## Actor(es)

Visitante anónimo (sin sesión). De forma secundaria, un `User` ya autenticado que visita `/`
directamente (p.ej. pega la URL a mano).

## Precondiciones

Ninguna — es una ruta pública, sin guard de autenticación.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un visitante sin sesión activa.
- **When** navega a `/`.
- **Then** ve la landing de bienvenida: cabecera fija (sticky) con el logo, enlaces de
  navegación a las secciones de la página y un botón "Iniciar sesión"; debajo, las secciones de
  contenido (hero, qué es, una captura real del Dashboard en un marco de navegador, ventajas,
  para quién es, footer).

- **Given** un visitante viendo la landing.
- **When** hace clic en uno de los enlaces de navegación de la cabecera.
- **Then** la página hace scroll suave hasta la sección correspondiente, sin quedar tapada por
  la cabecera fija.

- **Given** un visitante viendo la landing.
- **When** hace clic en "Iniciar sesión" (presente en la cabecera y también accesible desde el
  hero).
- **Then** navega a `/login`.

- **Given** un `User` ya autenticado (`AuthStateService.isAuthenticated()` en `true`).
- **When** navega a `/` (p.ej. pega la URL a mano tras haber iniciado sesión).
- **Then** se le redirige automáticamente a `/dashboard` sin llegar a ver la landing.

### Casos borde / errores de UI

- **Viewport móvil (< `md`, mixin `respond()` de `breakpoints.scss`)**: los enlaces de
  navegación de la cabecera colapsan tras un botón de menú (`aria-expanded`/`aria-controls`); no
  es un overlay modal (no tapa el contenido, no necesita atrapar el foco como sí hace el drawer
  de `SidebarComponent`), es una simple lista desplegable bajo la cabecera.
- **Ruta desconocida (`**`)**: sigue redirigiendo a `dashboard` igual que hoy — un visitante
  anónimo que llega a una URL rota cae en el guard existente y acaba en `/login`, no en la
  landing; no se toca este comportamiento.
- **Sin JavaScript de scroll-behavior disponible**: los enlaces son anchors normales
  (`href="#id"`), así que degradan a salto de scroll instantáneo del navegador si el
  `scroll-behavior: smooth` no aplica — no se depende de Router ni de código imperativo para el
  scroll-to.

### Componentes/pantallas involucrados

- `LandingPage` (nuevo, `frontend/src/app/marketing/pages/landing-page/`): página única con
  todas las secciones del OnePage.
- `LandingHeaderComponent` (nuevo, dentro de la misma carpeta): cabecera sticky con logo,
  navegación scroll-to y CTA de login; con su propio estado de menú móvil abierto/cerrado.
- `redirectIfAuthenticatedGuard` (nuevo, `frontend/src/app/core/guards/`): mismo patrón que
  `authGuard`, pero a la inversa — autenticado → `UrlTree` a `/dashboard`; anónimo → `true`.
- `frontend/src/app/app.routes.ts`: nueva entrada `{ path: '', pathMatch: 'full', ... }` para
  `LandingPage`, colocada antes del resto de rutas; el shell privado
  (`path: '', component: AppShellComponent`) no cambia.
- Captura real del Dashboard (`frontend/public/gfx/dashboard-screenshot.png`, cuenta demo) dentro
  de un marco de navegador decorativo (barra con "semáforos" + URL falsa), para que el visitante
  vea el producto real antes de entrar — no es una captura del propio visitante ni contiene datos
  de ningún cliente real, solo el entorno demo.

### Criterios de aceptación frontend

1. Un visitante sin sesión que navega a `/` ve la landing (no es redirigido a `/login`).
2. Un `User` autenticado que navega a `/` es redirigido a `/dashboard` sin ver la landing.
3. La cabecera permanece visible (`position: sticky`) al hacer scroll por el resto de la página.
4. Cada enlace de navegación de la cabecera lleva a su sección correspondiente
   (`href="#<id-sección>"`), y esa sección no queda tapada por la cabecera fija al llegar
   (`scroll-margin-top`).
5. El botón/enlace "Iniciar sesión" (en la cabecera y en el hero) navega a `/login`.
6. Ningún texto ni enlace de "registro"/"crear cuenta" aparece en la landing.
7. En viewport móvil (< `md`), los enlaces de navegación quedan ocultos tras un botón de menú
   con `aria-expanded` que refleja el estado abierto/cerrado, alcanzable y operable por teclado.
8. La landing reutiliza únicamente colores/espaciados/tipografía ya definidos en
   `frontend/src/styles/` (ninguna variable nueva) y los iconos ya existentes en
   `frontend/public/icons/` (ninguna descarga de icono nuevo); contraste de texto conforme a
   WCAG 2.1 AA, igual que el resto de la plataforma (Documento 12 §12.7).
