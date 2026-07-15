# Spec: Navegación / Shell (Sidebar + Breadcrumbs)

Feature vertical (Documento 0, "Specs verticales") sin parte de Backend: no introduce
ningún endpoint, entidad ni caso de uso nuevo — es puramente de presentación y routing
del Frontend. Se omite la sección Backend de la plantilla.

## Contexto

Hoy no existe ningún header, sidebar ni shell de layout compartido: `app.html` es
literalmente `<router-outlet /> <app-toast />`, y cada ruta top-level (`/dashboard`,
`/config/*`, `/alarms/*`, `/account/change-password`) se renderiza de forma aislada.

Esto deja dos huecos concretos, detectados al redactar esta spec:

- **No hay forma de navegar entre áreas de la aplicación.** `frontend/src/app/dashboard/pages/dashboard-page/dashboard-page.html`
  es la única pantalla con una cabecera de sesión propia (email del usuario, enlace a
  "Cambiar contraseña" y botón "Cerrar sesión" — ver `dashboard-page.ts`, comentario:
  "Conserva la cabecera de sesión del placeholder anterior (spec 05) ... fuera del alcance
  de esta spec"). Ninguna pantalla de `/config/*` ni `/alarms/*` tiene cabecera, enlace de
  vuelta al Dashboard, ni forma de cerrar sesión — una vez dentro de "Machines" o del panel
  de Alarmas, la única salida es editar la URL a mano o usar el botón "Atrás" del navegador.
- **No existe ningún asset de marca.** `frontend/public/` solo tiene `favicon.ico`; no hay
  ningún logo. El diseño visual final de esta pieza (color, tipografía, logo real) se
  revisará quando llegue el pase de diseño visual ya pospuesto por decisión del usuario
  (se está esperando a ver más specs con superficie visual antes de comprometer un sistema
  de diseño) — esta spec puede implementarse igualmente con un placeholder de marca
  (texto "EWControl" o un SVG provisional), porque su estructura y comportamiento no
  dependen de ese pase de diseño.

**Decisión de patrón**: sidebar lateral, no header horizontal. `/config` ya anida hasta 4
niveles (`machines/:machineId/signals/:signalId/alarm-definitions/:alarmDefinitionId/edit`,
`config.routes.ts`); una sidebar puede reflejar la sección de nivel superior activa de forma
persistente, y se complementa con un breadcrumb (ver más abajo) para la posición exacta
dentro de esa jerarquía anidada — un menú horizontal habría necesitado el breadcrumb desde
el día uno igualmente, sin ganar nada a cambio.

**Alcance solo de la zona privada**: el shell (sidebar + breadcrumb) se monta únicamente en
las rutas que hoy llevan `authGuard` (`/dashboard`, `/config/*`, `/alarms/*`,
`/account/change-password`). Las rutas públicas (`/login`, `/forgot-password`,
`/reset-password`, `auth.routes.ts`) no se envuelven en el shell y conservan su layout
centrado actual: no hay sesión ni rol que mostrar, y no tiene sentido ofrecer navegación a
otras áreas antes de autenticarse.

## Actor(es)

Cualquier `User` autenticado (`SuperAdmin` o `AdminCliente`).

## Precondiciones

El actor tiene una sesión autenticada activa — mismo criterio que usa hoy `authGuard`
(`frontend/src/app/core/guards/auth.guard.ts`): `AuthStateService.isAuthenticated()` en
`true`.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

- **Given** un `User` autenticado navega a cualquier ruta privada (`/dashboard`,
  `/config/*`, `/alarms/*`, `/account/change-password`).
- **When** la página carga.
- **Then** ve una sidebar lateral con: logo/nombre de la plataforma (enlaza a
  `/dashboard`), los ítems Dashboard, Configuración, Alarmas y Cuenta, y la sección de nivel
  superior correspondiente a la ruta activa resaltada visualmente.

- **Given** un `User` con rol `AdminCliente`.
- **When** ve la sidebar.
- **Then** el ítem "Companies" (dentro de Configuración) no aparece — mismo criterio que ya
  aplica `canManageCompanies()` (`config/use-cases/config-permissions.ts`) para ocultar la
  acción "Nueva Company" en las pantallas existentes; la sidebar reutiliza esa misma función,
  sin duplicar la condición de rol.

- **Given** un `User` con rol `SuperAdmin`.
- **When** ve la sidebar.
- **Then** el ítem "Companies" sí aparece dentro de Configuración.

- **Given** un `User` en cualquier ruta privada, incluidas las pantallas de listado
  (`/dashboard`, `/config/machines`, `/config/users`, `/config/companies`, `/alarms`,
  `/account/change-password`).
- **When** la página carga.
- **Then** ve un breadcrumb sobre el área de contenido, aunque sea de un único tramo (la
  página actual, sin enlace) — el breadcrumb no se reserva solo para rutas anidadas.

- **Given** un `User` navegando dentro de una ruta anidada de `/config`
  (`machines/:machineId/signals/:signalId/edit` o más profunda).
- **When** la página carga.
- **Then** ve un breadcrumb sobre el área de contenido con la ruta completa hasta ese punto
  (ej. "Machines / Torno 3 / Signals / Temperatura / Editar"), cada tramo (salvo el actual)
  enlazado a su nivel correspondiente.

- **Given** un `User` en cualquier ruta privada.
- **When** hace clic en "Cerrar sesión" desde el shell.
- **Then** se invoca `AuthStateService.logout()` y se redirige a `/login`, igual que hace hoy
  `dashboard-page.ts` (`logout()`); el botón de logout deja de estar duplicado por pantalla
  y pasa a vivir una única vez en el shell.

- **Given** un `User` autenticado navega a `/login`, `/forgot-password` o `/reset-password`
  directamente (ej. pega la URL a mano).
- **When** la página carga.
- **Then** no ve sidebar ni breadcrumb — esas rutas no cuelgan del shell.

### Casos borde / errores de UI

- **Solo dos versiones de la sidebar, sin tier intermedio**: docked/colapsable a partir de
  `md` (`respond()` de `breakpoints.scss`) y drawer móvil por debajo — no hay un estado
  "tablet" propio entre ambas.
- **Colapsar/expandir (≥ `md`)**: el usuario puede colapsar la sidebar a un rail de
  solo iconos; la preferencia se persiste (p.ej. `localStorage`) y se restaura en la próxima
  visita.
- **Drawer móvil (< `md`)**: la sidebar se oculta tras un
  botón de menú y se abre como panel off-canvas con foco atrapado dentro y cierre por
  `Escape` o clic en el backdrop — mismo patrón ya implementado en
  `ConfirmDialogComponent` (`shared/ui/confirm-dialog/confirm-dialog.component.ts`:
  `@HostListener('document:keydown.escape')`, `onBackdropClick()`, foco automático al abrir).
- **Breadcrumb en pantallas pequeñas**: si la ruta es muy profunda, el breadcrumb colapsa
  tramos intermedios (ej. "Machines / … / Editar") en vez de desbordar horizontalmente.
- **Ruta desconocida (`**`)**: como hoy redirige a `/dashboard`, el shell se monta con
  normalidad sobre esa redirección.
- **Ítems de rol**: si el rol del `User` cambia entre sesiones (no en caliente — requiere
  nuevo login), la sidebar refleja el rol del token actual en cada carga.

### Componentes/pantallas involucrados

- **Shell** (nuevo, p.ej. `core/layout/app-shell/`): montado como ruta padre de tipo layout
  en `app.routes.ts` para las rutas hoy marcadas con `canActivate: [authGuard]` — el guard
  se aplica una sola vez en ese nivel padre en vez de repetirse en cada ruta hija; las rutas
  de `auth.routes.ts` quedan fuera de este árbol y se renderizan igual que hoy, directo bajo
  `app.html`.
- **Sidebar** (dentro del shell): consume `AuthStateService.currentUser` (para email/rol) y
  las funciones ya existentes `canManageCompanies()`/`canConfigure()`/`canManageUsers()` de
  `config/use-cases/config-permissions.ts` para decidir ítems visibles, sin duplicar esa
  lógica de permisos.
- **`BreadcrumbComponent`** (nuevo, `shared/ui/breadcrumb/`): deriva el trail de navegación a
  partir de `ActivatedRoute` anidado y de un campo `data.breadcrumb` por ruta (a añadir en
  `config.routes.ts`, `alarms.routes.ts`).
- **Migración de `dashboard-page.html`**: se retira la cabecera de sesión ad-hoc (email,
  enlace a cambiar contraseña, botón de logout) que hoy vive solo ahí, quedando esa
  funcionalidad centralizada en el shell.

### Criterios de aceptación frontend

1. La sidebar se muestra en `/dashboard`, `/config/*`, `/alarms/*` y
   `/account/change-password`, y no se muestra en `/login`, `/forgot-password` ni
   `/reset-password`.
2. Con un `User` de rol `AdminCliente`, el ítem "Companies" no está presente en el DOM de la
   sidebar (no solo oculto por CSS).
3. Con un `User` de rol `SuperAdmin`, el ítem "Companies" sí está presente y navega a
   `/config/companies`.
4. La sección de nivel superior correspondiente a la ruta activa queda marcada como activa
   (verificable por `aria-current="page"` o equivalente), incluida cuando la ruta activa es
   una ruta anidada de `/config`.
5. En una ruta anidada de 4 niveles bajo `/config` (ej. edición de un `AlarmDefinition`), el
   breadcrumb muestra los tramos correctos en orden, cada uno enlazado salvo el actual. En
   una pantalla de listado (ej. `/config/machines`, `/dashboard`), el breadcrumb también se
   muestra, con un único tramo (la página actual, sin enlace) — solo no se muestra en las
   rutas públicas (`/login`, `/forgot-password`, `/reset-password`), que quedan fuera del
   shell.
6. Colapsar la sidebar en desktop y recargar la página conserva el estado colapsado.
7. En viewport móvil (< `md`), la sidebar arranca oculta, se abre como drawer con foco
   atrapado dentro, y se cierra con `Escape` o clic en el backdrop, devolviendo el foco al
   botón que la abrió.
8. Al hacer clic en "Cerrar sesión" desde el shell, se invoca `AuthStateService.logout()` y
   el usuario termina en `/login`.
9. Todo ítem de la sidebar y del breadcrumb es alcanzable y operable por teclado
   (`Tab`/`Enter`), sin trampas de foco fuera del drawer móvil abierto (WCAG 2.1 AA,
   Documento 12 apartado 12.7).
10. `dashboard-page.html` ya no incluye su propia cabecera de sesión (email, cambiar
    contraseña, logout) — esa funcionalidad solo vive en el shell.
