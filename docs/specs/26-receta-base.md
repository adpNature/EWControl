# Spec: Receta base (qué se ve, valores fijos, rangos y disposición del formulario de recetas)

## Contexto

La spec [25-recetas.md](25-recetas.md) creó las recetas: una plantilla con **un valor obligatorio para cada variable** de la categoría «Programación para la receta» (53 variables), mostradas en una lista en el orden de la GVL. En la práctica:

- hay variables que el operario no debería tocar, o que ni siquiera son datos de la receta (`xIrPosicionInicial` mueve un eje, `xRecetaActualizaHMI` es un comando);
- otras tienen siempre el mismo valor en una máquina concreta;
- los nombres del PLC (`rEspiras`, `xSentidoCabezal`) no dicen nada al operario, y una lista de 53 campos seguidos es difícil de rellenar;
- los límites que admite la receta son más estrechos que los del tipo de dato.

Esta spec añade la **receta base** de cada Machine: la configuración, hecha por un administrador, de la que parten todas las recetas de esa Machine. En ella se decide, para cada variable de receta:

- si **aparece** en el formulario de recetas y si tiene un **valor fijo**;
- su nombre visible, unidad, texto de ayuda, rango, decimales, longitud, valor por defecto y, según el tipo, los textos de «Sí/No» o una lista de opciones;
- y **dónde se coloca** en el formulario, en una cuadrícula de filas y anchos (100 %, 50 %, 33 %, 25 %…), con títulos de sección.

Resuelve además dos puntos que la spec 25 dejó fuera de alcance: **excluir de la receta las variables que no son datos** (se marcan como ocultas) y **los desplegables a partir de las descripciones** (lista de opciones, con una propuesta leída del comentario de la GVL).

**Lo que esta spec no hace:**

- **No se comunica con el PLC.** Igual que la spec 25: la receta base solo cambia datos en EWControl (PostgreSQL). Sí deja definido qué se escribirá cuando se cargue la receta activa en la máquina (ver «Lo que llega a la receta activa»).
- **No hay historial** de la receta base: solo se guarda quién la modificó por última vez y cuándo.
- **No hay varias recetas base por Machine**, ni se copian de una Machine a otra.

## Actor(es)

- `AdminCliente` (Machines de su Company) y `SuperAdmin` (cualquiera): consultan y editan la receta base.
- `SuperAdmin`, `AdminCliente` y `Operador`: usan el resultado en el formulario de recetas (spec 25). El `Operador` no puede ver ni editar la receta base.

## Precondiciones

- Las mismas de la spec 25: usuario autenticado con acceso a la Machine activa, categorías de la GVL importadas (spec 23) y variables de la categoría en el `nodeMapping` con su `dataType`.

## Modelo

**Variables de receta.** Se siguen calculando como en la spec 25 (categoría «Programación para la receta», mapeadas, tipo escalar soportado, orden de la GVL). La receta base no añade ni quita variables de ese conjunto: configura cómo se usa cada una.

**Modo de una variable.** Cada variable de receta tiene uno de cuatro modos:

| Modo            | ¿Aparece en el formulario de recetas? | ¿Se guarda un valor en cada receta? | ¿Llega a la receta activa?             |
| --------------- | ------------------------------------- | ----------------------------------- | -------------------------------------- |
| `EDITABLE`      | Sí, editable y obligatoria            | Sí                                  | Sí, con el valor de la receta          |
| `FIXED_VISIBLE` | Sí, en solo lectura                   | No                                  | Sí, con el valor fijo de la base       |
| `FIXED_HIDDEN`  | No                                    | No                                  | Sí, con el valor fijo de la base       |
| `HIDDEN`        | No                                    | No                                  | No: el PLC conserva el valor que tenga |

El **valor fijo se guarda solo en la receta base**, nunca se copia en las recetas: si se cambia, el cambio vale para todas las recetas de la Machine sin tocarlas.

**Receta base** (`RecipeTemplate`, tabla `recipe_templates`, migración `AddRecipeTemplatesSchema`):

- `id`, `machineId` (único, `ON DELETE CASCADE`): como mucho una por Machine;
- `variables` (JSONB): la configuración de cada variable de receta (ver abajo);
- `layout` (JSONB): la disposición del formulario (ver «Disposición»);
- `version`: sube en cada guardado, para detectar ediciones simultáneas;
- `createdAt`, `updatedAt`, `updatedByEmail`.

**Configuración de una variable** (todos los campos salvo `signalVariableName` y `mode` son opcionales; `null` = sin configurar):

| Campo                    | Tipos a los que aplica | Modos a los que aplica          | Regla                                                                                                                                                                 |
| ------------------------ | ---------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`                  | Todos                  | `EDITABLE`, `FIXED_VISIBLE`     | 1 a 60 caracteres. Sin él se muestra `signalVariableName`.                                                                                                            |
| `helpText`               | Todos                  | `EDITABLE`, `FIXED_VISIBLE`     | Hasta 300 caracteres. Sin él se muestra el comentario importado de la GVL.                                                                                            |
| `unit`                   | Enteros y reales       | `EDITABLE`, `FIXED_VISIBLE`     | Hasta 16 caracteres («mm», «rpm», «m/min»). Se muestra como sufijo del campo.                                                                                         |
| `decimals`               | `Float`, `Double`      | `EDITABLE`                      | Entero de 0 a 6: número máximo de decimales del valor.                                                                                                                |
| `min`, `max`             | Enteros y reales       | `EDITABLE`                      | Dentro del rango del tipo y, si el mapeo los tiene (spec 20), dentro de su `min`/`max`. `min ≤ max`.                                                                  |
| `minLength`, `maxLength` | `String`               | `EDITABLE`                      | Enteros de 0 a 256, `minLength ≤ maxLength`.                                                                                                                          |
| `booleanLabels`          | `Boolean`              | `EDITABLE`, `FIXED_VISIBLE`     | `{ "falseLabel", "trueLabel" }`, de 1 a 30 caracteres cada uno («Horario» / «Antihorario»). Sin ellos, «No» / «Sí».                                                   |
| `options`                | Enteros                | `EDITABLE`, `FIXED_VISIBLE`     | De 2 a 50 `{ "value", "label" }`: `value` entero dentro del rango efectivo, sin repetir; `label` de 1 a 60 caracteres. Si hay opciones, solo se admiten esos valores. |
| `defaultValue`           | Todos                  | `EDITABLE`                      | Debe cumplir las reglas efectivas. Rellena el campo en las recetas nuevas; se puede cambiar.                                                                          |
| `fixedValue`             | Todos                  | `FIXED_VISIBLE`, `FIXED_HIDDEN` | **Obligatorio** en esos modos. Debe cumplir las reglas efectivas.                                                                                                     |

Un campo que no aplica al tipo o al modo de la variable se rechaza (no se ignora en silencio), para que la configuración guardada sea siempre la que se ve en pantalla. En una variable fija, `booleanLabels` y `options` solo sirven para mostrar el valor fijo con su texto («Antihorario» en lugar de `true`).

**Reglas efectivas de un valor.** Un valor de receta, un valor fijo o un valor por defecto es válido si cumple, por este orden:

1. el tipo (`Boolean`, entero dentro del rango del tipo, real finito, `String` de hasta 256 caracteres), como en la spec 25;
2. el rango efectivo: `min`/`max` de la receta base si los tiene (solo en `EDITABLE`); si no, los del mapeo; si no, solo los del tipo;
3. `decimals`, `minLength`/`maxLength` y `options`, si están configurados.

Así, un valor fijo nunca puede salirse de los límites del mapeo, que son los que ya protegen la escritura en el PLC (spec 20).

**Disposición** (`layout`). Una cuadrícula de **12 columnas** organizada en filas:

```json
{
  "rows": [
    { "items": [{ "type": "TITLE", "span": 12, "text": "Bobinado" }] },
    {
      "items": [
        { "type": "VARIABLE", "span": 4, "signalVariableName": "rEspiras" },
        { "type": "VARIABLE", "span": 4, "signalVariableName": "rDiametroHilo" },
        { "type": "VARIABLE", "span": 4, "signalVariableName": "rVelocidad" }
      ]
    },
    {
      "items": [
        { "type": "VARIABLE", "span": 6, "signalVariableName": "xSentidoCabezal" },
        { "type": "SPACER", "span": 6 }
      ]
    }
  ]
}
```

- Tipos de elemento: `TITLE` (título de sección, `text` de 1 a 80 caracteres), `VARIABLE` (`signalVariableName`), `TEXT` (texto de ayuda suelto, `text` de 1 a 300 caracteres) y `SPACER` (hueco vacío, para alinear).
- `span` es el ancho en columnas: `3` (25 %), `4` (33 %), `6` (50 %), `8` (66 %), `9` (75 %) o `12` (100 %).
- En cada fila, la suma de `span` es como mucho 12. Una fila no puede estar vacía. Como mucho 200 filas.
- Cada variable `EDITABLE` o `FIXED_VISIBLE` aparece **exactamente una vez**. Las `FIXED_HIDDEN` y `HIDDEN` no aparecen.

**Receta base por defecto.** Mientras una Machine no tiene receta base guardada, se usa una calculada (no se guarda): todas las variables `EDITABLE`, sin más configuración, y la disposición en filas de tres variables al 33 % en el orden de la GVL. Con ella, las recetas se comportan exactamente como en la spec 25. La primera vez que un administrador guarda, se crea la fila en `recipe_templates`.

**Variables nuevas.** Si después de guardar la receta base aparecen variables de receta nuevas (se reimporta la GVL con la spec 23, se sincronizan variables con la spec 21 o cambia el mapeo), cuentan como `HIDDEN` hasta que un administrador las configure, y se señalan como «sin configurar». Así ninguna receta pasa a «Incompleta» por una variable que nadie ha revisado.

**Variables que desaparecen.** Si una variable configurada deja de ser variable de receta, su configuración y sus elementos de la disposición se ignoran, se señalan como «eliminadas» y desaparecen al volver a guardar la receta base.

**Configuración que deja de valer.** Si cambia el tipo de una variable o los límites del mapeo y una parte de su configuración ya no cumple las reglas:

- un `fixedValue` que ya no vale **bloquea la activación de recetas** en esa Machine (`409 RECIPE_TEMPLATE_INVALID`) hasta que un administrador lo corrija; la receta que ya estuviera activa sigue activa;
- `min`/`max`, `decimals`, `minLength`/`maxLength`, `options`, `booleanLabels` y `unit` que ya no valen o no aplican se ignoran (se vuelve al rango del mapeo o del tipo);
- un `defaultValue` que ya no vale se ignora.

Todo ello se informa en `staleConfig` hasta que se vuelva a guardar.

### Cambios en las recetas (spec 25)

- **Valores de una receta.** Una receta guarda un valor para cada variable `EDITABLE`, todos obligatorios. Enviar un valor de una variable `FIXED_*` o `HIDDEN` da `400 INVALID_RECIPE_VALUES` con `reason: NOT_EDITABLE`.
- **Validación.** Los valores se validan con las reglas efectivas. Nuevos `reason` en `INVALID_RECIPE_VALUES` y en `staleValues`: `NOT_AN_OPTION`, `TOO_MANY_DECIMALS` e `INVALID_LENGTH` (con `minLength`/`maxLength` en el detalle). `OUT_OF_RANGE` lleva el rango efectivo.
- **Valores de más.** Una receta puede tener guardados valores de variables que ya no son `EDITABLE` (han pasado a fijas u ocultas, o han dejado de ser variables de receta). Esos valores **no dejan la receta incompleta**: no falta información. Se ignoran, se devuelven en `ignoredValues` y desaparecen al volver a guardar la receta. Esto sustituye a la regla de la spec 25 por la que un valor de una variable que ya no es de receta (`NOT_A_RECIPE_VARIABLE`) dejaba la receta incompleta.
- **Recetas que pasan a incompletas** por un cambio en la receta base: una variable pasa a `EDITABLE` (le falta el valor en las recetas existentes) o se estrechan sus reglas (el valor guardado ya no vale). Se tratan con `missingVariables` y `staleValues`, como en la spec 25. El valor por defecto **no rellena** las recetas existentes: solo se propone en el formulario.
- **Activar** exige, además de la receta completa, que la receta base no tenga valores fijos que ya no valen (`409 RECIPE_TEMPLATE_INVALID`).

### Lo que llega a la receta activa

Contrato para la spec futura de carga en la máquina: los valores que se escribirán son los de las variables `EDITABLE` (valor de la receta) más los de las `FIXED_VISIBLE` y `FIXED_HIDDEN` (valor fijo de la receta base vigente). Las `HIDDEN` no se escriben. Esta spec solo expone esos valores (`effectiveValues` en el detalle de la receta); no los escribe.

## Backend

### Flujo principal (Given/When/Then)

**Consultar la receta base**

- **When** un `AdminCliente` o `SuperAdmin` llama a `GET /api/v1/machines/:machineId/recipe-template`.
- **Then** responde `200`:
  ```json
  {
    "category": { "id": "…", "name": "Programación para la receta" },
    "isDefault": false,
    "version": 4,
    "updatedAt": "2026-11-14T10:00:00.000Z",
    "updatedByEmail": "demo@ewcontrol.local",
    "variables": [
      {
        "signalVariableName": "xSentidoCabezal",
        "dataType": "Boolean",
        "comment": "2 opciones: 0 - Horario / 1 - Antihorario",
        "mappingMin": null,
        "mappingMax": null,
        "isUnconfigured": false,
        "suggestedOptions": null,
        "suggestedBooleanLabels": { "falseLabel": "Horario", "trueLabel": "Antihorario" },
        "config": {
          "mode": "EDITABLE",
          "label": "Sentido del cabezal",
          "helpText": null,
          "unit": null,
          "decimals": null,
          "min": null,
          "max": null,
          "minLength": null,
          "maxLength": null,
          "booleanLabels": { "falseLabel": "Horario", "trueLabel": "Antihorario" },
          "options": null,
          "defaultValue": false,
          "fixedValue": null
        }
      }
    ],
    "layout": { "rows": [] },
    "removedVariables": ["xVariableAntigua"],
    "staleConfig": [
      { "signalVariableName": "rEspiras", "field": "max", "reason": "OUT_OF_MAPPING_RANGE" }
    ],
    "excludedCount": 2
  }
  ```
  (en el ejemplo solo se muestra una variable y la disposición vacía).
- **And** `variables` lleva todas las variables de receta en el orden de la GVL; las nuevas, con `isUnconfigured: true` y `mode: HIDDEN`.
- **And** `suggestedOptions` y `suggestedBooleanLabels` son una propuesta leída del comentario de la GVL cuando sigue el patrón «N opciones: 0 - Texto / 1 - Texto…» (para enteros, opciones; para `Boolean` con dos opciones, los textos de `false`/`true`). Es solo una sugerencia: no se aplica hasta que el administrador la acepta y guarda.
- **And** sin receta base guardada, devuelve la receta base por defecto con `isDefault: true` y `version: 0`.

**Guardar la receta base**

- **When** un `AdminCliente` o `SuperAdmin` llama a `PUT /api/v1/machines/:machineId/recipe-template` con `{ "variables": [{ "signalVariableName", "mode", …config }], "layout": { "rows": […] }, "version": 4 }`, con una entrada para **cada** variable de receta actual.
- **Then** valida la configuración y la disposición, guarda (o crea, si no existía), sube `version`, actualiza `updatedAt`/`updatedByEmail`, descarta la configuración de las variables eliminadas y responde `200` con la receta base como en el `GET`.
- **And** no modifica ninguna receta: las que dejan de estar completas se detectan al leerlas, como en la spec 25.

**Calcular el impacto antes de guardar**

- **When** se llama a `POST /api/v1/machines/:machineId/recipe-template/impact` con el mismo cuerpo que el `PUT` (sin `version`).
- **Then**, sin guardar nada, responde `200`:
  ```json
  {
    "recipesBecomingIncomplete": 12,
    "activeRecipeBecomingIncomplete": { "id": "…", "title": "Bobina 120 mm" },
    "examples": ["Bobina 120 mm", "Bobina 80 mm"]
  }
  ```
  `recipesBecomingIncomplete` cuenta las recetas que hoy están completas y con la nueva receta base no lo estarían; `activeRecipeBecomingIncomplete` es `null` si la activa no está entre ellas; `examples` lleva hasta 10 títulos.
- **And** si el cuerpo no es válido, responde el mismo `400` que el `PUT`.

**Variables de receta para el formulario** (cambio de `GET /api/v1/machines/:machineId/recipe-variables`, spec 25, los tres roles)

- **Then** responde, además de lo que ya devolvía, lo necesario para pintar el formulario:
  - `variables`: solo las `EDITABLE` y `FIXED_VISIBLE`, cada una con `mode`, `label`, `helpText`, `unit`, `decimals`, `booleanLabels`, `options`, `defaultValue` (solo `EDITABLE`), `fixedValue` (solo `FIXED_VISIBLE`), y `min`/`max`/`minLength`/`maxLength` **efectivos**;
  - `layout`: la disposición, sin los elementos de variables eliminadas;
  - `hiddenCount`: cuántas variables no aparecen (`FIXED_HIDDEN` y `HIDDEN`, incluidas las sin configurar);
  - `isTemplateValid`: `false` si algún valor fijo ya no vale.
  - Los valores de las `FIXED_HIDDEN` no se exponen en esta ruta.

**Detalle de una receta** (cambio de `GET …/recipes/:recipeId`, spec 25)

- **Then** añade `ignoredValues: [{ signalVariableName, value }]` y `effectiveValues: [{ signalVariableName, value, source }]`, con `source` `RECIPE` o `FIXED`: lo que llegaría a la máquina. Si la receta no está completa o la receta base no es válida, `effectiveValues` es `null`.

### Casos borde / errores (Given/When/Then)

**Validación de la receta base**

- Cuerpo mal formado, campo no declarado o un texto por encima de su límite: `400` con el formato estándar de validación de payload ([11-api-rest.md](../11-api-rest.md), "Validación de payloads").
- Problemas de configuración o de disposición: `400 INVALID_RECIPE_TEMPLATE` con todos los problemas, no solo el primero, en `details`:
  - por variable, `{ signalVariableName, field?, reason }` con `reason`:
    - `MISSING`: falta la configuración de una variable de receta actual;
    - `NOT_A_RECIPE_VARIABLE`, `DUPLICATED`;
    - `NOT_APPLICABLE`: un campo que no aplica al tipo o al modo (p. ej. `options` en un `Float`, `fixedValue` en una `EDITABLE`);
    - `FIXED_VALUE_REQUIRED`: modo `FIXED_*` sin `fixedValue`;
    - `INVALID_RANGE`: con `field` (`min` o `max`), `rangeReason` (`MIN_GREATER_THAN_MAX`, `OUT_OF_TYPE_RANGE` u `OUT_OF_MAPPING_RANGE`) y los límites que se han superado;
    - `INVALID_LENGTH`, `INVALID_DECIMALS`, `INVALID_OPTIONS` (repetidas, menos de 2 o más de 50, fuera de rango);
    - `INVALID_DEFAULT_VALUE`, `INVALID_FIXED_VALUE`: con el `reason` del valor (`TYPE_MISMATCH`, `OUT_OF_RANGE`, `NOT_AN_OPTION`…) en `valueReason`;
  - por disposición, `{ row, item?, reason }` con `reason`:
    - `EMPTY_ROW`, `ROW_TOO_WIDE` (la suma de `span` pasa de 12), `INVALID_SPAN`, `TOO_MANY_ROWS`;
    - `TEXT_REQUIRED` (`TITLE` o `TEXT` sin texto) y `TEXT_TOO_LONG` (más de 80 caracteres en un título o de 300 en un texto);
    - `VARIABLE_NOT_PLACED` (con `signalVariableName`): una variable visible que no está en la disposición;
    - `VARIABLE_NOT_VISIBLE`: una variable `FIXED_HIDDEN`, `HIDDEN` o que no es de receta colocada en la disposición;
    - `VARIABLE_REPEATED`.
- La Machine no tiene la categoría «Programación para la receta» o no tiene variables de receta: `PUT` e `impact` responden `409 RECIPE_VARIABLES_NOT_AVAILABLE`. El `GET` responde `200` con `category: null` y listas vacías.

**Ediciones simultáneas**

- **Given** dos administradores que abren la receta base con `version: 4`.
- **When** el primero guarda (pasa a `version: 5`) y después guarda el segundo con `version: 4`.
- **Then** el segundo recibe `409 RECIPE_TEMPLATE_MODIFIED` y no se sobrescribe nada.
- Con la receta base por defecto (`version: 0`), si otro administrador la ha guardado entretanto, también `409 RECIPE_TEMPLATE_MODIFIED`.

**Guardado de una receta mientras cambia la receta base**

- Una receta se valida contra la receta base vigente en el momento de guardarla. Si la receta base cambia justo después, la receta puede quedar incompleta: es el caso normal de «Recetas que pasan a incompletas».

**Acceso**

- El `Operador` recibe `403` en las tres rutas de `recipe-template`.
- Una Machine de otra Company, inexistente o inactiva: `404`, como en el resto de la API.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección "Recipe" (se amplía):

| Método | Ruta                                                     | Roles                    |
| ------ | -------------------------------------------------------- | ------------------------ |
| GET    | `/api/v1/machines/:machineId/recipe-template`            | AdminCliente, SuperAdmin |
| PUT    | `/api/v1/machines/:machineId/recipe-template`            | AdminCliente, SuperAdmin |
| POST   | `/api/v1/machines/:machineId/recipe-template/impact`     | AdminCliente, SuperAdmin |
| GET    | `/api/v1/machines/:machineId/recipe-variables` (cambia)  | Los tres                 |
| GET    | `/api/v1/machines/:machineId/recipes/:recipeId` (cambia) | Los tres                 |

Las rutas nuevas llevan `@roles(...CONFIGURATION_ROLES)` y su decisión está cubierta por `route-permissions.spec.ts`.

Errores nuevos: `INVALID_RECIPE_TEMPLATE` (400), `RECIPE_TEMPLATE_MODIFIED` (409), `RECIPE_TEMPLATE_INVALID` (409, al activar). Nuevos `reason` en `INVALID_RECIPE_VALUES`: `NOT_EDITABLE`, `NOT_AN_OPTION`, `TOO_MANY_DECIMALS`, `INVALID_LENGTH`.

### Criterios de aceptación backend

1. `GET /recipe-template` devuelve todas las variables de receta en el orden de la GVL con su configuración, la disposición, `version`, las variables sin configurar (como `HIDDEN`), las eliminadas y la configuración que ya no vale. Sin receta base guardada, devuelve la receta base por defecto (`isDefault: true`), que reproduce el comportamiento de la spec 25.
2. `PUT /recipe-template` exige una configuración para cada variable de receta y una disposición válida, y rechaza con `400 INVALID_RECIPE_TEMPLATE`, con todos los problemas, cualquier campo que no aplique al tipo o al modo, valores fijos o por defecto que no cumplan las reglas efectivas, rangos fuera del tipo o del mapeo, filas de más de 12 columnas, variables visibles sin colocar y variables ocultas colocadas.
3. Guardar con una `version` antigua da `409 RECIPE_TEMPLATE_MODIFIED` sin sobrescribir.
4. `POST /recipe-template/impact` cuenta, sin guardar nada, las recetas que pasarían de completas a incompletas, e indica si la activa está entre ellas.
5. Las rutas de `recipe-template` son solo de `AdminCliente`/`SuperAdmin` (el `Operador` recibe `403`), y una Machine ajena da `404`.
6. Las recetas solo admiten y exigen valores de las variables `EDITABLE`, validados con las reglas efectivas (`NOT_EDITABLE`, `NOT_AN_OPTION`, `TOO_MANY_DECIMALS`, `INVALID_LENGTH`, `OUT_OF_RANGE` con el rango efectivo).
7. Los valores guardados de variables que ya no son `EDITABLE` no dejan la receta incompleta: salen en `ignoredValues` y desaparecen al guardarla. Una variable que pasa a `EDITABLE` o unas reglas más estrechas sí la dejan incompleta.
8. Las variables nuevas de la categoría cuentan como `HIDDEN` hasta configurarlas y no cambian la completitud de ninguna receta.
9. Un valor fijo que deja de valer bloquea la activación (`409 RECIPE_TEMPLATE_INVALID`) sin desactivar la receta activa; el resto de configuración que deja de valer se ignora y se informa en `staleConfig`.
10. `GET /recipe-variables` devuelve solo las variables visibles con sus reglas efectivas y la disposición, sin exponer los valores `FIXED_HIDDEN`. El detalle de una receta completa devuelve `effectiveValues` (valores `EDITABLE` de la receta + valores fijos de la base, sin las `HIDDEN`).
11. Nada de esta spec lee ni escribe en el PLC ni genera puntos en InfluxDB.
12. Cobertura ≥ 80 % en Entities y Use Cases. La validación de la configuración y de la disposición, las reglas efectivas, la receta base por defecto, la lectura de opciones desde el comentario, el cálculo de impacto y la nueva evaluación de recetas son funciones puras con tests unitarios.

### Pruebas

- **Unitarias**: validación de cada campo por tipo y modo; rango efectivo (base → mapeo → tipo); validación de la disposición (anchos, filas, variables colocadas una vez, ocultas no colocadas); receta base por defecto; variables sin configurar y eliminadas; `staleConfig`; propuesta de opciones y de textos `Boolean` a partir de comentarios reales de la GVL (con y sin tilde, con espacios irregulares, con texto que no sigue el patrón); evaluación de recetas con `ignoredValues`; cálculo de impacto; casos de uso con repositorios falsos.
- **Integración** (un test por flujo, contra PostgreSQL real): receta base por defecto → crear una receta → guardar una receta base que oculta una variable, fija otra y estrecha un rango → calcular el impacto (1 receta) → la receta queda incompleta por el rango, no por la variable oculta → guardar con `version` antigua (`409`) → reimportar la GVL con una variable nueva (sin configurar, la receta no cambia de estado) → `effectiveValues` incluye el valor fijo y no la variable oculta.
- **E2E** (Playwright): un `AdminCliente` configura la receta base (oculta una variable, fija otra visible, añade un título y pone dos variables al 50 %) y un `Operador` crea una receta: ve el título y la disposición, el valor fijo en solo lectura y no ve la variable oculta.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

**Llegar a la receta base**

- **Given** un `AdminCliente` o `SuperAdmin`.
- **When** está en el detalle de una Machine (junto al enlace a «Categorías», spec 23) o en la pantalla «Recetas» con esa Machine elegida.
- **Then** ve el enlace «Receta base», que abre `/config/machines/:machineId/recipe-template`. El `Operador` no ve el enlace y la ruta lo devuelve al Dashboard.

**Pantalla de la receta base.** Tres pestañas: «Variables», «Disposición» y «Vista previa». Un aviso al principio indica si se está viendo la receta base por defecto («Esta máquina usa la receta base por defecto: todas las variables editables»), si hay variables sin configurar («3 variables nuevas sin configurar») o eliminadas, y si hay configuración que ya no vale.

**Pestaña «Variables»**

- **Then** ve todas las variables de receta en el orden de la GVL, con un buscador (nombre, etiqueta o descripción), un filtro «Mostrar» (todas, por modo o sin configurar) y la etiqueta «Sin configurar» en las nuevas. Un resumen en la cabecera cuenta cuántas variables hay en cada modo.
- Cada fila muestra el nombre del PLC, el tipo, el comentario de la GVL, un selector de modo («Editable», «Fija y visible», «Fija y oculta», «Oculta») y la etiqueta visible.
- **When** despliega una fila.
- **Then** ve solo los campos que aplican a su tipo y modo: texto de ayuda, unidad, decimales, mínimo y máximo (con los del mapeo como referencia), longitud, textos de «No/Sí», opciones, valor por defecto o valor fijo (con el control de su tipo: interruptor, número, desplegable o texto).
- **When** hay una propuesta leída del comentario.
- **Then** aparece «Usar las opciones de la descripción» (o «Usar "Horario / Antihorario"» para un `Boolean`), que rellena los campos para que el administrador los revise.

**Pestaña «Disposición»**

- **Then** ve las filas del formulario, cada una con sus elementos a su ancho real. Cada elemento muestra la etiqueta de la variable (o el texto del título) y un selector de ancho: 25 %, 33 %, 50 %, 66 %, 75 % o 100 %.
- **And** puede:
  - añadir una fila, un título, un texto o un hueco;
  - mover un elemento a la izquierda o a la derecha dentro de su fila, o a la fila de arriba o de abajo, con botones;
  - arrastrar y soltar elementos y filas (`@angular/cdk/drag-drop`), como alternativa más cómoda a los botones;
  - subir o bajar una fila, y quitar títulos, textos y huecos (las variables no se quitan aquí: se ocultan en «Variables»). Una fila que se queda vacía desaparece sola; para empezar una fila nueva se suelta un elemento en la zona «Suelta aquí para crear una fila nueva» o se mueve con «a la fila de abajo» desde la última.
- **And** cada fila muestra cuánto ocupa (barra y porcentaje); una fila que pasa de 12 columnas se marca en rojo con el texto «Esta fila ocupa más del 100 %», y no se puede guardar.
- **When** en «Variables» se pasa una variable a «Editable» o «Fija y visible».
- **Then** se coloca automáticamente al final de la disposición, en la última fila si cabe o en una fila nueva.
- **When** se pasa a «Fija y oculta» u «Oculta».
- **Then** se quita de la disposición.

**Pestaña «Vista previa»**

- **Then** ve el formulario tal como lo verá quien cree una receta, con el mismo componente que el formulario real (spec 25), con los valores por defecto y los fijos, y un selector de ancho de pantalla (móvil, tablet, escritorio) para comprobar cómo se reordena.

**Guardar**

- **When** pulsa «Guardar».
- **Then** la app valida en el cliente (valores fijos y por defecto, rangos, filas, variables colocadas) y llama a `POST …/recipe-template/impact`.
- **And** si alguna receta pasaría a incompleta, un diálogo pide confirmación: «Este cambio deja 12 recetas incompletas (entre ellas la activa, "Bobina 120 mm"). Habrá que revisarlas antes de poder activarlas», con hasta 10 títulos de ejemplo.
- **And** al confirmar (o si no afecta a ninguna), llama a `PUT`, muestra un toast «Receta base guardada» y se queda en la pantalla.

**Formulario de recetas** (cambios en `recipe-form-page`, spec 25)

- **Then** se pinta según la disposición: títulos de sección, textos y variables en filas, cada elemento a su ancho.
- **And** cada variable muestra su etiqueta, su texto de ayuda (el propio o, si no, el comentario) y su unidad como sufijo; un `Boolean` con textos muestra el texto del estado actual junto al interruptor («Antihorario»); un entero con opciones se muestra como desplegable.
- **And** una variable `FIXED_VISIBLE` se muestra en solo lectura, con su valor legible (el texto de la opción o del `Boolean`, y la unidad) y la etiqueta «Valor fijo».
- **And** en una receta nueva, los campos con valor por defecto empiezan rellenos. Al duplicar se usan los valores de la original y, si falta alguno, el valor por defecto.
- **And** el contador indica «X de Y variables con valor», contando solo las editables.
- **And** con el filtro activo, la disposición se sustituye por una lista simple de las variables que coinciden, y al vaciar el filtro vuelve la disposición.
- **And** un texto discreto bajo el formulario indica «N variables no aparecen porque están ocultas o tienen un valor fijo oculto».

**Detalle de la receta activa.** En el formulario de una receta completa, un bloque plegable «Lo que llegaría a la máquina» lista `effectiveValues` con su origen («Receta» o «Valor fijo»). Por ahora no se envía nada (spec 25).

### Casos borde / errores de UI

- **Machine sin la categoría «Programación para la receta»**: la pantalla de la receta base muestra el mismo mensaje que la spec 25, con el enlace a las categorías.
- **Errores de validación del Backend** (`400 INVALID_RECIPE_TEMPLATE`): se marcan las variables y las filas afectadas; la pestaña con errores muestra un indicador con el número, y el foco va al primer error de la pestaña abierta.
- **Edición simultánea** (`409 RECIPE_TEMPLATE_MODIFIED`): diálogo con «Recargar la receta base» (descarta los cambios propios) o «Seguir editando».
- **Valor fijo que ya no vale**: en la pantalla de la receta base, la variable se marca con el error. En «Recetas», un aviso para todos los roles: «La receta base tiene valores fijos que ya no son válidos. No se pueden activar recetas hasta que un administrador la revise» (con enlace a la receta base para `AdminCliente`/`SuperAdmin`), y «Activar» queda deshabilitado.
- **Receta incompleta** (spec 25): los campos que faltan empiezan rellenos con el valor por defecto si lo hay, pero siguen marcados hasta guardar. Los `ignoredValues` se listan en el aviso como «valores que se quitarán al guardar porque la variable ya no es editable».
- **Cambios sin guardar** en la receta base: salir pide confirmación.
- **Pantallas estrechas**: por debajo de `md`, todos los elementos ocupan el 100 % y los huecos no se muestran; en `md`, los elementos de hasta el 50 % ocupan el 50 % y el resto el 100 %; desde `lg`, el ancho configurado. El editor de la disposición se usa en cualquier ancho, pero muestra un aviso en móvil recomendando una pantalla más grande.

### Componentes/pantallas involucrados

Referencia: [08-frontend-dashboard.md](../08-frontend-dashboard.md) §8.6 y [12-convenciones-frontend.md](../12-convenciones-frontend.md).

- `config/pages/recipe-template-page`: ruta `/config/machines/:machineId/recipe-template`, con breadcrumb, solo para `AdminCliente`/`SuperAdmin`, con las tres pestañas y guarda de cambios sin guardar.
- `recipes/components/recipe-layout` (componente): pinta una disposición con sus elementos. Lo usan el formulario de recetas y la vista previa, para que se vean igual. La cuadrícula es **Flexbox** (no CSS Grid ni posicionamiento absoluto), con el ancho de cada elemento como custom property (`--span`) y los cambios de ancho con el mixin `respond()`.
- `config/components/recipe-template-variable-row` (componente): una variable en la pestaña «Variables», con sus campos según tipo y modo.
- `config/components/recipe-layout-editor` (componente): la pestaña «Disposición», con botones de mover accesibles por teclado (`aria-label` en cada botón de icono) y arrastrar y soltar. Al mover un elemento con los botones, se anuncia la nueva posición con una región `aria-live`.
- `recipes/components/recipe-value-field` (spec 25): añade unidad, textos de `Boolean`, desplegable de opciones y modo solo lectura.
- Nueva dependencia: `@angular/cdk` (misma versión mayor que Angular) para el arrastrar y soltar.
- Se reutilizan el diálogo de confirmación, el toast y las clases de formulario existentes. Las pestañas siguen el patrón WAI-ARIA (`tablist`/`tab`/`tabpanel`, flechas, Inicio y Fin) dentro de la propia página.
- Iconos: solo `arrow-left.svg` (Iconsax Essential, ya descargado), girado para las cuatro direcciones. El asa de arrastre y la flecha de «más ajustes» se dibujan con CSS y el valor fijo se señala con la etiqueta «Valor fijo», para no añadir iconos sin descargarlos a mano del set gratuito (12.5).

### Criterios de aceptación frontend

1. «Receta base» aparece en el detalle de la Machine y en «Recetas» solo para `AdminCliente`/`SuperAdmin`; el `Operador` no ve el enlace ni puede abrir la ruta.
2. En «Variables» se elige el modo de cada variable y solo se muestran los campos que aplican a su tipo y modo; las variables nuevas se señalan como «Sin configurar» y empiezan ocultas; las propuestas del comentario se pueden aplicar con un botón.
3. En «Disposición» se añaden filas, títulos, textos y huecos, se cambia el ancho de cada elemento y se mueven elementos y filas con botones accesibles por teclado y con arrastrar y soltar. Una fila de más del 100 % se señala y bloquea el guardado.
4. Pasar una variable a visible la coloca al final de la disposición; pasarla a oculta la quita.
5. La vista previa muestra el formulario real, con la disposición, los valores por defecto y los fijos, en tres anchos de pantalla.
6. Al guardar, si el cambio deja recetas incompletas, se pide confirmación indicando cuántas y si la activa está entre ellas. Un `409 RECIPE_TEMPLATE_MODIFIED` ofrece recargar o seguir editando.
7. El formulario de recetas se pinta según la disposición, con etiquetas, unidades, ayuda, textos de `Boolean`, desplegables, valores por defecto en recetas nuevas y valores fijos visibles en solo lectura; las variables ocultas no aparecen.
8. La disposición se adapta al ancho de pantalla según los puntos de corte descritos.
9. Con un valor fijo que ya no vale, «Recetas» muestra el aviso según el rol y no deja activar.
10. Los errores son accesibles (`aria-invalid`, mensaje asociado con `aria-describedby`) y el foco va al primero.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

- **A01 Control de acceso**: las rutas de la receta base llevan `@roles(...CONFIGURATION_ROLES)` y resuelven la Machine con el `MachineAccessResolver` (otra Company → `404`). El `Operador` solo recibe lo necesario para el formulario: los valores `FIXED_HIDDEN` no salen en `recipe-variables`.
- **A03 Inyección / XSS**: etiquetas, textos de ayuda, títulos, opciones y unidades los escribe un administrador y los lee el `Operador`: se pintan siempre como texto con la interpolación de Angular, nunca con `innerHTML`.
- **A04 Diseño inseguro**:
  - límites de tamaño en todos los textos, 50 opciones por variable y 200 filas, para acotar el JSONB;
  - un valor fijo se valida igual que un valor de receta (tipo, rango del mapeo), así que la receta base no permite saltarse los límites que ya protegen la escritura (spec 20);
  - las variables nuevas entran ocultas: nada llega a la receta activa sin que un administrador lo haya decidido.
- **Mass assignment**: DTOs anidados con `whitelist`/`forbidNonWhitelisted`. `version` solo como comprobación; `updatedByEmail` y las fechas no se aceptan en el cuerpo.

## Fuera de alcance

- Cargar la receta activa en la máquina (sigue pendiente; esta spec solo fija qué valores llegarían).
- Varias recetas base por Machine (por familia de producto) y copiar la receta base de otra Machine.
- **Visibilidad condicional** (mostrar una variable solo si otra tiene un valor, p. ej. los parámetros de piramidal solo con el piramidal activado).
- Historial de cambios de la receta base y «restablecer la receta base por defecto».
- Que el valor por defecto rellene automáticamente las recetas existentes a las que les falta.
- Límites leídos del PLC («Límites de los datos de la receta», `rMinEspiras`/`rMaxEspiras`…).
- Elementos de la disposición que ocupen varias filas, o anchos distintos de 25/33/50/66/75/100 %.
