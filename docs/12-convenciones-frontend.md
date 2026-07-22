# 12. Convenciones de Frontend

## Introducción

Este documento fija las convenciones de código y estilos del Frontend (Angular, Documento 8): naming, arquitectura de SCSS, qué se implementa como clase CSS global y qué como Angular Component, responsive y accesibilidad.

El objetivo es que cualquier feature vertical nueva (Documento 0, "Specs verticales") construya su parte de Frontend reutilizando siempre las mismas piezas, en vez de reinventar estilos o componentes por pantalla.

---

## 12.1 Naming

Todo identificador de Frontend —variables y propiedades TypeScript, variables SCSS, nombres de mixins/funciones— se escribe en **camelCase**.

```scss
// SCSS
$primaryColor: #1a73e8;
$fontSizeLg: 1.25rem;
$borderRadiusMd: 8px;
```

```typescript
// TypeScript
const isLoading = signal(false);
const currentCompanyId = computed(() => this.session.companyId());
```

Los nombres de clases CSS reutilizables (12.4) usan kebab-case por ser la convención estándar de CSS/HTML (`.title-lg`, `.form-field`), ya que aplican sobre atributos `class` de HTML, no sobre identificadores de código.

Estas reglas se verifican automáticamente antes de cada commit mediante ESLint (`frontend/eslint.config.js`) y Stylelint (`frontend/.stylelintrc.json`); ver Documento 0, "Enforcement automático de convenciones".

---

## 12.2 Arquitectura de Estilos

El CSS específico de cada componente Angular se mantiene **mínimo**: solo lo que no se puede resolver con una clase global. Todo lo reutilizable vive en `frontend/src/styles/`:

```
src/styles/
  global.scss       Punto de entrada: importa el resto y define reglas base (reset, box-sizing, body).
  colors.scss        Paleta de color: $variables SCSS + su exposición como Custom Properties en :root.
  typography.scss    Familias, tamaños y pesos de fuente.
  spacing.scss        Escala de padding/margin/gap.
  radius.scss         Escala de border-radius.
  breakpoints.scss    Mixins de responsive (12.5).
  form.scss           Clases reutilizables de formulario (12.4).
  layout.scss          Clases reutilizables de layout (box, tablas Flex, contenedores).
```

`global.scss` es el único fichero de estilos importado globalmente (en `angular.json` / `styles.ts`); el resto se importa siempre a través de él, nunca duplicado en cada componente.

---

## 12.3 Variables de Tema

Cada propiedad visual repetida en la plataforma (color, tipografía, tamaño, border-radius, padding) es una variable, nunca un valor suelto en un componente.

Se definen dos veces, deliberadamente, con un único origen de verdad:

1. **SCSS `$variable`** (camelCase): fuente de verdad, usada en tiempo de compilación, con autocompletado y validación de tipos de Sass.
2. **CSS Custom Property `--variable`** (kebab-case, convención nativa de CSS): expuesta en `:root` a partir de la variable SCSS, para permitir cambiar el tema en **runtime** (por ejemplo, un futuro modo oscuro) sin recompilar. No se implementa un selector de tema todavía, pero la infraestructura queda lista.

```scss
// colors.scss
$primaryColor: #ff6b35;
$primaryColorHover: #e85a28;
$textColor: #1d1d1b;
$textMutedColor: #6b6b69;
$backgroundColor: #ffffff;
$surfaceColor: #faf9f8;
$borderColor: #e4e1dd;

$successColor: #2f9e44;
$successBackground: #eaf6ec;
$warningColor: #e8a400;
$warningBackground: #fff4db;
$dangerColor: #dc3545;
$dangerBackground: #fbe9ea;
$infoColor: #2f80ed;
$infoBackground: #eaf2fe;

:root {
  --primary-color: #{$primaryColor};
  --primary-color-hover: #{$primaryColorHover};
  --text-color: #{$textColor};
  --text-muted-color: #{$textMutedColor};
  --background-color: #{$backgroundColor};
  --surface-color: #{$surfaceColor};
  --border-color: #{$borderColor};
  --success-color: #{$successColor};
  --success-background: #{$successBackground};
  --warning-color: #{$warningColor};
  --warning-background: #{$warningBackground};
  --danger-color: #{$dangerColor};
  --danger-background: #{$dangerBackground};
  --info-color: #{$infoColor};
  --info-background: #{$infoBackground};
}
```

Los componentes consumen siempre la Custom Property (`var(--primary-color)`), nunca la `$variable` SCSS directamente en su propio `.scss`, salvo dentro de los propios ficheros de `styles/` que la definen. Así, un cambio de tema en runtime (cambiar las Custom Properties vía JS/clase en `<html>`) afecta a toda la plataforma sin recompilar.

| Categoría             | Variables SCSS                                                                                             | Custom Property expuesta                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Color                 | `$primaryColor`, `$textColor`, `$backgroundColor`, `$surfaceColor`, `$borderColor`                         | `--primary-color`, `--text-color`, `--background-color`, `--surface-color`, `--border-color` |
| Color de estado       | `$successColor/Background`, `$warningColor/Background`, `$dangerColor/Background`, `$infoColor/Background` | `--success-color/-background`, `--warning-...`, `--danger-...`, `--info-...`                 |
| Color de edición      | `$editColor`, `$editColorHover`                                                                            | `--edit-color`, `--edit-color-hover`                                                         |
| Tipografía            | `$fontFamilyBase`, `$fontSizeSm/Md/Lg/Xl`                                                                  | `--font-family-base`, `--font-size-sm/md/lg/xl`                                              |
| Border-radius         | `$borderRadiusSm/Md/Lg`                                                                                    | `--border-radius-sm/md/lg`                                                                   |
| Spacing (padding/gap) | `$spacingXs/Sm/Md/Lg/Xl`                                                                                   | `--spacing-xs/sm/md/lg/xl`                                                                   |

### Paleta de marca

Colores de marca aportados por el usuario: primario `#c8421f` (naranja/rojizo) y texto `#1d1d1b`. A partir de ellos se propone la paleta de estado completa de la tabla anterior, elegida para diferenciarse claramente del primario (evitando que "warning" se confunda con el color de marca) y para funcionar bien junto a él: verde `#2F9E44` (éxito), ámbar `#E8A400` (advertencia, desplazado hacia el amarillo para no solaparse con el primario), rojo `#DC3545` (error, con más componente magenta que el primario para distinguirse a simple vista) y azul `#2F80ED` (información, como contraste frío frente a una paleta de marca cálida). Para la acción "Editar" (docs/specs/16-pulido-visual-frontend.md) se añade un quinto tono, azul más oscuro que el de información: `$editColor` (`#1565c0`).

**Hallazgo de contraste**: `#c8421f` con texto blanco encima da un contraste de ~4.94:1, por encima del mínimo de 4.5:1 exigido por WCAG 2.1 AA (apartado 12.6) — por eso `.btn-primary` (`buttons.scss`) sí pinta su texto en blanco. El resto de superficies sólidas en `$primaryColor` que no han verificado su contraste individualmente (badges, navegación activa) siguen pintando el texto con `$textColor` (`#1d1d1b`) por defecto, que sobre ese color alcanza contraste de sobra. `$infoColor` (`#2F80ED`) con blanco encima solo da ~3.9:1 — no cumple AA — por eso el botón "Editar" no reutiliza ese color: usa `$editColor` (`#1565c0`), que con blanco llega a ~5.7:1.

Para los estados (éxito/advertencia/error/info) se usa el patrón "fondo tintado + texto oscuro fijo": el texto de un mensaje de estado siempre usa `$textColor`, y el color semántico se reserva para el fondo tintado, el borde o el icono — así el contraste del texto nunca depende de qué estado se muestre.

### Tipografía

Familia tipográfica: **Fira Sans**, cargada como _web font_ con los pesos Regular (400), Medium (500) y Bold (700). Se define como `$fontFamilyBase: 'Fira Sans', sans-serif;`, con una pila de _fallback_ a fuentes de sistema (`sans-serif`) para el tiempo de carga inicial.

---

## 12.4 Reutilización de UI

No toda pieza reutilizable necesita ser un Angular Component. La regla es según complejidad:

| Pieza                           | Implementación                                                                                                                           | Motivo                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Títulos (`h1`-`h4`)             | Clases CSS globales (`.title-xl`, `.title-lg`...) sobre etiquetas HTML nativas                                                           | Sin lógica ni estado; un componente sería sobrecoste innecesario.                                                                                                                              |
| Párrafos / texto                | Clases CSS globales (`.text-body`, `.text-muted`...)                                                                                     | Igual que títulos.                                                                                                                                                                             |
| Box / contenedor                | Clase CSS global (`.box`)                                                                                                                | Puramente visual (padding, border-radius, degradado); sin comportamiento.                                                                                                                      |
| Botón (acción)                  | Clases CSS globales (`.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-edit`, `styles/buttons.scss`) sobre `<button>`/`<a>` nativos | Sin estado propio más allá del nativo del elemento — docs/specs/16-pulido-visual-frontend.md.                                                                                                  |
| Label                           | Clase CSS global (`.form-label`) sobre `<label>` nativo                                                                                  | Sin lógica propia.                                                                                                                                                                             |
| Input / campo de formulario     | Angular Component (`InputComponent`, integrado con Reactive Forms via `ControlValueAccessor`)                                            | Tiene estado (valor, validación, error) y comportamiento (eventos, accesibilidad de errores).                                                                                                  |
| Formulario completo             | Angular Component (`FormFieldComponent`, orquestando Inputs/Labels)                                                                      | Coordina validación y layout de varios campos.                                                                                                                                                 |
| Tabla                           | Angular Component (`TableComponent`), envuelta en `.table-scroll` (clase CSS global, `overflow-x: auto`)                                 | Tiene estado (orden, paginación) y lógica de renderizado por columnas; el scroll horizontal es puramente visual, sin estado propio.                                                            |
| Widget del Dashboard (tamaño)   | Clase CSS global (`.widget`, `styles/layout.scss`), ancho responsive por breakpoint                                                      | Puramente visual (tamaño uniforme entre widgets); sin comportamiento — docs/specs/16-pulido-visual-frontend.md.                                                                                |
| Anuncio para lector de pantalla | Clase CSS global (`.visually-hidden`, `styles/layout.scss`) sobre una región `aria-live`                                                 | Puramente visual (oculta el texto sin quitarlo del árbol de accesibilidad); sin comportamiento propio — docs/specs/16-pulido-visual-frontend.md.                                               |
| Notificación / Toast            | Angular Component (`ToastComponent`) + `ToastService`                                                                                    | Tiene estado compartido entre toda la aplicación (cola de mensajes activos) y comportamiento temporal (auto-dismiss); ver detalle abajo.                                                       |
| Diálogo de confirmación         | Angular Component (`ConfirmDialogComponent`)                                                                                             | Tiene estado (abierto/cerrado) y comportamiento (foco al abrir, cierre por Escape/backdrop) — imprescindible antes de una acción destructiva (docs/specs/06-gestion-machines-signals.md).      |
| Sidebar / Shell de navegación   | Angular Component (shell de layout de la zona privada)                                                                                   | Tiene estado (colapsado/expandido persistido, sección activa) y comportamiento (drawer off-canvas en móvil con foco atrapado, cierre por Escape/backdrop) — docs/specs/12-navegacion-shell.md. |
| Breadcrumb                      | Angular Component (`BreadcrumbComponent`)                                                                                                | Deriva el trail de navegación del `ActivatedRoute` anidado (lógica), no es solo presentación estática — docs/specs/12-navegacion-shell.md.                                                     |

Todas estas piezas —con o sin componente Angular— se maquetan siempre con **Flexbox** (`display: flex`), nunca con `float` ni posicionamiento absoluto para layout, salvo casos justificados (overlays, tooltips).

### Notificaciones (Toast)

- **Disparo**: cualquier servicio o componente llama a `toastService.show({ type, message })`, con `type` en `success | warning | danger | info` — reutilizando exactamente los colores de estado del apartado 12.3 (fondo tintado + `$textColor`, nunca texto de color variable).
- **Posición**: esquina superior derecha, en un `ToastComponent` de posición fija (`position: fixed`) montado una única vez en el layout raíz, para no competir en el flujo Flexbox del resto de la pantalla.
- **Apilado**: hasta 3 toasts visibles simultáneamente, en columna (Flexbox, `flex-direction: column`, `gap: var(--spacing-sm)`); si llega un 4º mientras hay 3 activos, se descarta primero el más antiguo.
- **Descarte**: auto-dismiss transcurridos unos segundos (configurable por `type`; por ejemplo, `danger` puede durar más que `success`), con opción de cierre manual antes de tiempo mediante un botón de icono (Iconsax, apartado 12.5) con `aria-label="Cerrar notificación"`.
- **Accesibilidad**: hay **dos** regiones `aria-live` separadas montadas simultáneamente (`polite` para `success`/`warning`/`info`, `assertive` para `danger`), no una única región que cambia de atributo dinámicamente — WAI-ARIA desaconseja alternar la "politeness" de una región ya montada, así que cada toast se renderiza en la región fija correspondiente a su `type`. De este modo un lector de pantalla anuncia el mensaje sin que el usuario tenga que tener el foco sobre él.

```scss
// layout.scss
.box {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-lg);
  border-radius: var(--border-radius-md);
  background: linear-gradient(175deg, #1d1d1b33 0%, #ffffff29 100%), #fff;
}

.table-flex {
  display: flex;
  flex-direction: column;

  &__row {
    display: flex;
    gap: var(--spacing-sm);
  }
}
```

---

## 12.5 Iconografía

Los iconos usan **Iconsax**, en su versión gratuita (set "Essential"), como SVGs individuales importados por componente (no como _icon font_, para poder aplicar `aria-hidden`/`aria-label` icono a icono).

### SVGs descargados manualmente, no un paquete npm

Se evaluaron dos vías de implementación: un paquete comunitario (ej. `@ng-icons/iconsax`) que expone el catálogo de Iconsax como funciones SVG tree-shakeable, o descargar manualmente los `.svg` del set gratuito y servirlos como assets propios.

Se descarta el paquete comunitario porque mezcla en un único paquete npm **todo** el catálogo de Iconsax, incluidos los estilos de pago, sin ningún mecanismo que impida usar por error un icono no licenciado — ese riesgo solo se detectaría en una auditoría manual, nunca en build ni en CI. Se opta por descargar manualmente el set gratuito real y mantener únicamente esos SVGs en el repo (`frontend/public/icons/`, ver su propio `README.md`): es físicamente imposible usar un icono no licenciado porque no existe en el proyecto. El coste asumido es perder el tree-shaking automático de un paquete npm y mantener un `IconComponent` propio (`frontend/src/app/shared/ui/icon/icon.component.ts`) que carga cada SVG por nombre vía `HttpClient` + `DomSanitizer`, cacheado en memoria — aceptable frente a la garantía de licencia que exige una plataforma comercial.

> Antes de usar un icono fuera del set "Essential" gratuito, verificar la licencia de Iconsax: la versión de pago cubre variantes y categorías adicionales, y mezclar accidentalmente iconos de pago sin licencia sería un incumplimiento de licencia, no solo un problema de estilo.

Regla de accesibilidad (Documento 12, apartado 12.7): todo icono decorativo (que acompaña a un texto ya visible) lleva `aria-hidden="true"`; todo icono que es el único contenido de un elemento interactivo (ej. un botón de icono sin texto) lleva `aria-label` describiendo la acción, nunca el nombre del icono.

---

## 12.6 Responsive

Enfoque **mobile-first**: los estilos base son para móvil, y se amplían hacia pantallas mayores con `min-width`.

Breakpoints estándar:

| Nombre | Ancho mínimo | Uso típico                    |
| ------ | ------------ | ----------------------------- |
| `sm`   | 480px        | Móvil grande                  |
| `md`   | 768px        | Tablet                        |
| `lg`   | 1024px       | Portátil / escritorio pequeño |
| `xl`   | 1280px       | Escritorio                    |
| `xxl`  | 1400px       | Escritorio grande             |

```scss
// breakpoints.scss
@use 'sass:map';

$breakpoints: (
  sm: 480px,
  md: 768px,
  lg: 1024px,
  xl: 1280px,
  xxl: 1400px,
);

@mixin respond($breakpoint) {
  @media (min-width: map.get($breakpoints, $breakpoint)) {
    @content;
  }
}
```

```scss
// Uso en cualquier fichero de styles/ o componente
.dashboard-grid {
  display: flex;
  flex-direction: column;

  @include respond(md) {
    flex-direction: row;
  }
}
```

Ningún componente define sus propios breakpoints; todos usan el mixin `respond()` sobre la escala de `breakpoints.scss`.

---

## 12.7 Accesibilidad

Objetivo: **WCAG 2.1 nivel AA**. Checklist aplicable a toda pieza nueva de UI:

- **Contraste**: texto normal ≥ 4.5:1, texto grande (≥18pt o 14pt negrita) ≥ 3:1 frente a su fondo (verificado contra las Custom Properties de `colors.scss`; ver el hallazgo de contraste documentado en el apartado 12.3).
- **Foco visible**: ningún elemento interactivo elimina el `outline` de foco sin sustituirlo por un indicador visible propio.
- **Labels asociados**: todo `input`/`select`/`textarea` tiene un `<label for>` o `aria-label` asociado; `InputComponent` (12.4) lo exige por contrato.
- **Roles ARIA**: solo cuando el HTML semántico nativo no baste (ej. un `TableComponent` con orden de columnas anuncia el estado vía `aria-sort`); se prioriza siempre HTML semántico (`<button>`, `<nav>`, `<table>`) sobre `div`/`span` con rol añadido.
- **Navegación por teclado**: todo elemento interactivo es alcanzable y operable con `Tab`/`Enter`/`Espacio`, sin trampas de foco.
- **Textos alternativos e iconos**: toda imagen con significado propio lleva `alt`; los iconos siguen la regla del apartado 12.5 (`aria-hidden` si son decorativos, `aria-label` si son el único contenido de un control).

Los tests de componentes con Testing Library (12.8) refuerzan esta checklist: al consultar los componentes por rol y texto accesible (`getByRole`, `getByLabelText`) en vez de por selector CSS, un componente inaccesible falla el test antes de llegar a revisión manual. El ruleset `templateAccessibility` de `angular-eslint` (Documento 0, "Enforcement automático de convenciones") añade una primera verificación automática antes incluso de ejecutar tests.

---

## 12.8 Testing de Frontend

- **Vitest**: runner de tests unitarios y de componentes, también usado en el Backend (Documento 0) para mantener un único runner y una única configuración mental en todo el stack. Se descarta Jasmine/Karma (stack histórico de Angular CLI) porque Angular está migrando su propio soporte oficial hacia Vitest, y porque unificar el runner con el Backend evita mantener dos configuraciones de test distintas.
- **Testing Library** (`@testing-library/angular`) sobre Vitest: los tests consultan los componentes por rol/texto accesible en vez de por implementación interna, lo que además verifica accesibilidad (12.7) de forma continua.
- **Playwright** para e2e, ejecutando la aplicación real contra el Backend (incluyendo el Simulador, Documento 10, para tener datos deterministas en los tests). Se descarta Cypress porque Playwright soporta multi-browser y multi-tab de forma nativa, con mejor paralelización y sin las restricciones de iframes de Cypress.

Cada criterio de aceptación de Frontend de una spec (Documento 0, plantilla vertical) se traduce en un test de Vitest/Testing Library (unitario/componente) o de Playwright (flujo completo), nunca en verificación manual únicamente.

---

## Decisión Arquitectónica

Las convenciones de este documento existen para que ninguna feature vertical nueva tenga que decidir de nuevo cómo nombrar una variable, dónde poner un estilo o si algo debe ser componente o clase global. Cualquier necesidad de UI que no encaje en las tablas de 12.3/12.4 se resuelve ampliando esas tablas, no introduciendo una excepción puntual en un componente.
