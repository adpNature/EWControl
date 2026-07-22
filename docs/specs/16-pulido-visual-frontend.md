# Spec: Pulido visual y UX de la plataforma

Feature vertical (Documento 0) sin parte de Backend: no introduce ningún endpoint, entidad
ni caso de uso nuevo — es puramente de presentación, estilos e interacción del Frontend. Se
omite la sección Backend de la plantilla.

**Nota de proceso**: esta spec se redacta después de haber implementado y verificado el
trabajo que describe, no antes — desviación explícita del orden que exige
`docs/00-metodologia-y-calidad.md` ("Ninguna funcionalidad se programa sin una spec previa").
El motivo es la decisión ya documentada en [12-navegacion-shell.md](12-navegacion-shell.md)
(Contexto): _"El diseño visual final de esta pieza (color, tipografía, logo real) se revisará
cuando llegue el pase de diseño visual ya pospuesto por decisión del usuario (se está
esperando a ver más specs con superficie visual antes de comprometer un sistema de diseño)"_.
Ese pase de diseño es precisamente el que cubre esta spec; se documenta ahora, a posteriori,
en vez de dejarlo sin registrar.

## Contexto

Tras implementarse las specs 05-15 con un placeholder de marca (texto "EWControl", sin logo,
sin favicon propio) y un sistema visual mínimo (colores/botones/tablas sin pulir, sin
interactividad en las gráficas), tocaba el pase de diseño visual pospuesto. Esta spec
documenta ese pase: identidad de marca real, sistema de color con contraste verificado,
sistema de botones consistente, comportamiento responsive del grid de widgets del Dashboard,
y interactividad (tooltips + ejes) en las gráficas de históricos.

## Actor(es)

Cualquier `User` autenticado (`SuperAdmin` o `AdminCliente`) — transversal a toda la zona
privada, no depende de rol.

## Precondiciones

El actor tiene una sesión autenticada activa (mismo criterio que
[12-navegacion-shell.md](12-navegacion-shell.md)).

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

**Identidad de marca**

- **Given** un `User` autenticado en cualquier ruta privada.
- **When** la página carga.
- **Then** la sidebar muestra el logo real (`logoEnergyWinders.png`) en vez del placeholder
  de texto "EWControl" que dejó pendiente la spec 12; la pestaña del navegador muestra el
  título "Energy Winders - Control" y el favicon de marca.

**Sistema de color y contraste**

- **Given** la paleta de marca definida en `docs/12-convenciones-frontend.md` §12.3.
- **When** se pinta cualquier superficie sólida en `$primaryColor` con texto encima.
- **Then** el texto usa blanco (`.btn-primary`) solo donde el contraste verificado lo permite
  (`#c8421f` con blanco ≈ 4,94:1, cumple WCAG AA); el resto de superficies en `$primaryColor`
  sin verificar individualmente siguen usando `$textColor`.
- **Given** la nueva acción "Editar" necesita un color propio, distinto de éxito/aviso/error.
- **When** se evalúa reutilizar `--info-color` (`#2F80ED`) para ese botón.
- **Then** se descarta: con texto blanco encima da ~3,9:1 (no cumple AA); se define un tono
  más oscuro dedicado, `--edit-color` (`#1565c0`, ~5,7:1 con blanco), en vez de forzar el uso
  de un color pensado para otro propósito.

**Sistema de botones**

- **Given** cualquier acción de la plataforma.
- **When** se decide su estilo.
- **Then** usa una de las cuatro clases globales reutilizables (`.btn-primary`, `.btn-secondary`,
  `.btn-danger`, `.btn-edit` — `frontend/src/styles/buttons.scss`), nunca un estilo ad-hoc; el
  texto no hace salto de línea (`white-space: nowrap` + `flex-shrink: 0`) y, si el elemento es
  un `<a>`, no muestra el subrayado por defecto del navegador.
- **Given** una acción "Editar" (fila de tabla o detalle de una entidad).
- **When** se implementa.
- **Then** es siempre un `<button>` con navegación programática (`Router.navigate`), nunca un
  `<a routerLink>` — una acción de edición no es un enlace de navegación libre, y como
  `<button>` se beneficia directamente del sistema de botones de la plataforma.

**Sidebar**

- **Given** la sidebar en viewport de escritorio (≥ `md`).
- **When** se muestra.
- **Then** tiene fondo degradado y esquinas redondeadas en las cuatro esquinas (panel
  flotante); en viewport móvil (drawer a pantalla completa) solo redondea/bordea el lado
  derecho, el único que no toca un borde de pantalla.
- **Given** un enlace de navegación de la sidebar.
- **When** el usuario pasa el ratón por encima, o el enlace está activo.
- **Then** el texto pasa a `font-weight: 700` y (solo en hover) el espacio entre icono y
  texto aumenta ligeramente, con una transición suave.
- **Given** la sidebar colapsada (rail de solo iconos, ≥ `md`).
- **When** se muestra el botón "Cerrar sesión".
- **Then** pierde el fondo sólido y queda solo el icono en `--primary-color`.

**Tabla compartida (`TableComponent`)**

- **Given** una tabla con columna de acciones (`actionsTemplate`).
- **When** se renderiza.
- **Then** la cabecera "Acciones" y los botones de la fila quedan alineados a la derecha, con
  separación entre ellos (`gap`), y los botones son más pequeños que su tamaño normal fuera de
  una tabla (padding/font-size reducidos solo dentro de `.table__actions`).
- **Given** cualquier tabla (`TableComponent` o el widget TABLE del Dashboard) en una
  resolución donde su contenido no cabe (ej. columna de fecha larga en móvil).
- **When** el contenido excede el ancho disponible.
- **Then** la tabla hace scroll horizontal dentro de su propio contenedor (`.table-scroll`,
  `overflow-x: auto`), sin desbordar ni descuadrar el resto de la página.

**Grid responsive de widgets del Dashboard**

- **Given** el Dashboard con varios widgets.
- **When** se visualiza en distintas resoluciones.
- **Then** cada widget (excepto TABLE, ver más abajo) mide igual y ocupa: 100% en móvil, 50%
  desde `md` (768px), 33% desde `lg` (1024px) y 25% desde `xxl` (1400px, breakpoint nuevo) —
  ver "Casos borde" para el widget TABLE.

**Tooltips y ejes en gráficas de históricos**

- **Given** la gráfica comparativa de históricos (`MultiSeriesChartComponent`) o el widget
  CHART del Dashboard (`ChartWidgetComponent`), con datos suficientes para dibujar línea.
- **When** el usuario pasa el ratón por encima del área de la gráfica.
- **Then** aparece una línea guía vertical en la posición del cursor y un tooltip con el valor
  (y unidad) de cada serie en esa posición; al salir el ratón del área, desaparecen ambos.
- **Given** la gráfica comparativa de históricos.
- **When** se muestra, con un rango temporal (`from`/`to`) conocido.
- **Then** el eje X muestra 5 marcas temporales adaptadas al span total (minutos/horas si es
  corto, fecha si es largo — ver "Casos borde") y el eje Y muestra guías relativas
  `100 % / 50 % / 0 %` (nunca un valor absoluto — ver "Casos borde").
- **Given** la misma gráfica, para un usuario que no usa ratón.
- **When** llega al área de la gráfica con `Tab` (queda enfocada, con contorno visible).
- **Then** ve el tooltip en la primera posición, igual que si hubiera pasado el ratón; con
  `←`/`→` recorre las mismas posiciones que el hover (`Home`/`End` saltan al principio/final),
  `Escape` lo oculta sin perder el foco, y al salir de la gráfica (`blur`) se oculta también —
  equivalente por teclado exigido por WCAG 2.1 AA 2.1.1 (Keyboard) y 1.4.13 (Content on Hover
  or Focus). Una región `aria-live="polite"` oculta anuncia el mismo valor para lectores de
  pantalla.

### Casos borde / errores de UI

- **Tooltip cerca del borde derecho**: si la posición del cursor supera el 50% del ancho de
  la gráfica, el tooltip se abre hacia la izquierda (`--flip`) en vez de hacia la derecha,
  para no desbordar el borde y provocar scroll lateral de la página.
- **Widget TABLE siempre 100%**: a diferencia del resto de tipos de widget, el widget TABLE
  del Dashboard ignora el ancho responsive del grid y ocupa siempre la fila completa en
  cualquier breakpoint — una tabla con varias columnas no cabe razonablemente en 25%/33% de
  ancho.
- **Eje Y sin magnitud absoluta compartida**: cada serie de la gráfica comparativa se
  normaliza a su propio min/max (decisión ya tomada en
  [14-historicos-comparativas.md](14-historicos-comparativas.md), "Alcance explícito" punto
  5, por Signals de unidades distintas comparadas en un mismo gráfico); el eje Y 0/50/100%
  introducido aquí es una _implementación visual_ de esa decisión ya tomada, no una nueva —
  no se añade un eje con valores reales ni se contradice esa spec.
- **Widget CHART del Dashboard no cambia de fuente de datos**: el tooltip/hover añadido no
  toca su comportamiento ya definido en
  [07-dashboard-tiempo-real.md](07-dashboard-tiempo-real.md) (histórico inicial vía REST +
  acumulación en vivo por WebSocket, sin consulta de histórico adicional).
- **`<select>` nativo**: el navegador ancla su flecha nativa a una distancia fija del borde
  (ignora `padding-right`); se desactiva ese `appearance` y se dibuja una flecha propia
  (`public/icons/arrow-down.svg`, derivado de `arrow-left.svg` rotado -90º) vía
  `background-image`, separada del borde con `background-position`.
- **Contraste de `--edit-color`**: se descarta reutilizar `--info-color` para el botón
  "Editar" precisamente porque con blanco encima no llega al mínimo AA (~3,9:1) — ver "Sistema
  de color y contraste" arriba.

### Componentes/pantallas involucrados

- **Tokens/estilos globales** (`frontend/src/styles/`): `colors.scss` (paleta primaria y
  `--edit-color`), `buttons.scss` (`.btn-primary/-secondary/-danger/-edit`),
  `breakpoints.scss` (breakpoint `xxl`), `layout.scss` (`.widget`, `.table-scroll`),
  `form.scss` (flecha del `<select>`), `typography.scss`.
- **Sidebar** (`core/layout/sidebar/`): logo, gradiente, hover/activo, colapsado — ver
  [12-navegacion-shell.md](12-navegacion-shell.md) para el resto de su comportamiento (drawer,
  breadcrumb, permisos por rol), no modificado por esta spec.
- **`IconComponent`** (`shared/ui/icon/icon.component.ts`): `:host { display: contents }` no
  aplica aquí — el fix fue en los widgets del Dashboard (ver abajo); `IconComponent` solo
  ganó un ajuste de `display` para que el SVG interno no arrastre altura de línea base extra.
- **`TableComponent`** (`shared/ui/table/table.component.{html,scss}`): alineación y tamaño de
  acciones, scroll horizontal.
- **Botones "Editar"**: `config/pages/{company-list-page,user-list-page,machine-detail-page,
signal-form-page}.{html,ts}`, `alarms/pages/alarm-panel-page/alarm-panel-page.html`.
- **Dashboard**: `dashboard/pages/dashboard-page/dashboard-page.{html,scss}` (grid),
  `dashboard/widgets/{value,gauge,chart,table,alarm-list}/*.{html,scss,ts}` (todos con
  `:host { display: contents }` para que el `div.box.widget` interno sea el flex item real;
  `table-widget` además fuerza `width: 100%`); `chart-widget.component.{html,scss,ts}`
  (tooltip + navegación por teclado + región `aria-live`).
- **Históricos**: `history/pages/history-page/{history-page.html,
multi-series-chart/multi-series-chart.component.{html,scss,ts}}` (tooltip + ejes +
  navegación por teclado + región `aria-live`).
- **`.visually-hidden`** (`styles/layout.scss`, clase global nueva): contenido solo para
  lectores de pantalla, usado por la región `aria-live` de ambas gráficas.

### Criterios de aceptación frontend

1. La sidebar muestra `logoEnergyWinders.png`; la pestaña del navegador muestra el título y
   favicon de marca.
2. `.btn-primary` renderiza con texto blanco sobre `--primary-color`; `.btn-edit` existe y usa
   `--edit-color`/`--edit-color-hover` — verificable visualmente y por los estilos aplicados.
3. Los botones "Editar" de Users, Companies, Machines, Signals y reglas de alarma son
   `<button>` (no `<a>`) y, al pulsarlos, navegan a la ruta de edición correcta:
   - `user-list-page.spec.ts` — _"click en 'Editar' navega a la edición del User (ruta relativa)"_.
   - `company-list-page.spec.ts` — _"click en 'Editar' navega a la edición de la Company (ruta relativa)"_.
   - `machine-detail-page.spec.ts` — _"click en 'Editar' (Machine) navega a la edición de la Machine"_
     y _"click en 'Editar' (Signal) navega a la edición de la Signal"_.
   - `signal-form-page.spec.ts` — _"click en 'Editar' de una regla de alarma navega a su edición"_.
4. En la gráfica comparativa de históricos y en el widget CHART del Dashboard, pasar el ratón
   por la gráfica muestra el valor de cada serie en esa posición, con línea guía; cerca del
   borde derecho el tooltip se abre hacia la izquierda; al salir el ratón, desaparece:
   - `multi-series-chart.component.spec.ts` — describe _"tooltip al pasar el ratón"_ (4 tests:
     sin hover no hay tooltip, valores al inicio, flip + valores al final, se oculta al salir).
   - `chart-widget.component.spec.ts` — describe _"tooltip al pasar el ratón"_ (4 tests
     equivalentes).
     4bis. La misma información es alcanzable y operable por teclado (WCAG 2.1 AA 2.1.1 / 1.4.13):
     `Tab` enfoca la gráfica (contorno visible) y muestra el tooltip en la primera posición,
     `←`/`→`/`Home`/`End` recorren las posiciones, `Escape` oculta sin perder el foco, `blur`
     oculta también; una región `aria-live="polite"` oculta anuncia el valor:
   - `multi-series-chart.component.spec.ts` — describe _"equivalente por teclado del tooltip
     (WCAG 2.1 AA 2.1.1 / 1.4.13)"_ (5 tests).
   - `chart-widget.component.spec.ts` — describe _"equivalente por teclado del tooltip (WCAG
     2.1 AA 2.1.1 / 1.4.13)"_ (5 tests equivalentes).
5. La gráfica comparativa de históricos muestra 5 marcas en el eje X (adaptadas al span del
   rango) y las guías `100 % / 50 % / 0 %` en el eje Y, alineadas con el área de dibujo.
6. Los widgets del Dashboard miden igual entre sí en cada breakpoint (100/50/33/25%), excepto
   el widget TABLE, que siempre ocupa el 100%.
7. Una tabla (`TableComponent` o widget TABLE) con contenido más ancho que su contenedor hace
   scroll horizontal propio sin ensanchar la página (`document.body.scrollWidth` igual al
   viewport).
8. La cabecera y las celdas de la columna de acciones de cualquier tabla quedan alineadas a la
   derecha, con los botones visiblemente más pequeños que fuera de una tabla.
