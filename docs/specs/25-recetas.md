# Spec: Recetas (CRUD + buscador)

## Contexto

En el HMI de la bobinadora, el operario programa cada trabajo en la pantalla «Programación receta»: espiras, diámetro de hilo, velocidad, topes, modo ortocíclico, piramidal… El programador del PLC agrupa esas variables en la GVL bajo la subcategoría **«Programación para la receta»** (53 variables), que EWControl ya conoce gracias a la importación de categorías de [23-categorias-variables-plc.md](23-categorias-variables-plc.md).

Esta spec permite **crear y gestionar recetas en EWControl**. Una receta es una plantilla con un título y **un valor para cada variable del grupo «Programación para la receta»**, que más adelante se usará para poner la máquina en marcha. Incluye:

- listado de recetas por Machine con buscador;
- alta, edición y borrado;
- duplicar una receta;
- marcar una receta como **«Activa»**.

**Lo que esta spec no hace:**

- **No se comunica con el PLC.** Ni lee ni escribe: guardar, editar o activar una receta solo cambia datos en EWControl (PostgreSQL).
- **«Activa» es solo una marca.** Hoy no tiene ningún efecto sobre la máquina; deja preparado el dato para una spec futura que cargará la receta activa en la máquina.
- **Las recetas no van a ningún historial.** No se escriben en InfluxDB, no se guardan versiones anteriores y no hay registro de cambios: solo se guarda quién la modificó por última vez y cuándo.

**Relación con los paquetes de escritura** ([20-paquetes-escritura-opc-ua.md](20-paquetes-escritura-opc-ua.md)). Los paquetes son conjuntos pequeños de valores fijos que se escriben en el PLC al ejecutarlos, y solo los gestionan `AdminCliente`/`SuperAdmin`. Las recetas son otra cosa: plantillas completas de un trabajo, que crean los tres roles y que hoy no se escriben. Son entidades independientes; no se comparten tablas ni pantallas.

## Actor(es)

`SuperAdmin`, `AdminCliente` y `Operador` (de la Company de la Machine; el `SuperAdmin`, de cualquiera): consultan, buscan, crean, editan, duplican, borran y activan recetas.

## Precondiciones

- El usuario está autenticado ([05-auth-login.md](05-auth-login.md)) y tiene acceso a la Machine, que está activa.
- La Machine tiene las categorías de la GVL importadas (spec 23), entre ellas «Programación para la receta».
- Las variables de esa categoría están en el `nodeMapping` de la conexión, con su `dataType` (specs 18, 20 y 21).

## Modelo

**Categoría de recetas (fija).** Es siempre la categoría llamada **«Programación para la receta»**. No se configura por Machine. El Backend la busca entre las categorías de la Machine comparando el nombre sin distinguir mayúsculas ni tildes, para que valga tanto «Programacion para la receta» (como llega al importar el CSV) como «Programación para la receta» (renombrada). El nombre es una constante del Backend.

- Si hay más de una categoría con ese nombre en la Machine, se usa la primera en el orden de la GVL (`position`).
- Si no hay ninguna (no se han importado categorías, o se ha renombrado a otra cosa), la Machine no tiene variables de receta (ver casos borde).
- Volver a importar el CSV (spec 23) no afecta a las recetas: se vuelve a encontrar por el nombre.

**Variables de receta** (calculadas, no se guardan). Son las entradas del catálogo (`variable_catalog_entries`) de esa categoría que cumplen todo esto:

- su `nodeId` está en el `nodeMapping` de la Machine;
- su `dataType` es uno de los escalares soportados: `Boolean`, `SByte`, `Byte`, `Int16`, `UInt16`, `Int32`, `UInt32`, `Float`, `Double` o `String`.

De cada una se expone `signalVariableName`, `dataType`, `comment` (la descripción importada, p. ej. «2 opciones: 0 - Horario / 1 - Antihorario»), y `min`/`max` si el mapeo los tiene (spec 20). Se ordenan por la `position` del catálogo, que es el orden de la GVL. Las variables de la categoría que no cumplen las condiciones no aparecen en el formulario; solo se cuentan (`excludedCount`).

**Receta** (`Recipe`, tabla `recipes`, migración `AddRecipesSchema`):

- `id`, `machineId` (`ON DELETE CASCADE`; hereda la Company de la Machine);
- `title`: 1 a 120 caracteres, se recorta; único dentro de la Machine **sin distinguir mayúsculas ni tildes**;
- `description`: opcional, hasta 500 caracteres;
- `values: [{ signalVariableName, value }]`: **un valor (`boolean`, `number` o `string`) para cada variable de receta, todos obligatorios**;
- `isActivated`, `activatedAt`, `activatedByEmail`: la marca «Activa». Como mucho **una receta activa por Machine**, garantizado con un índice único parcial;
- `version`: entero que sube en cada edición, para detectar ediciones simultáneas;
- `createdAt`, `createdByEmail`, `updatedAt`, `updatedByEmail`. Se guarda el email, no una referencia al User, para que siga mostrándose aunque se borre el usuario.

Borrar una receta la elimina físicamente: no hay papelera ni historial.

**Validación de un valor** según el `dataType` de su variable:

- `Boolean`: `true` o `false`;
- enteros (`SByte`, `Byte`, `Int16`, `UInt16`, `Int32`, `UInt32`): número entero dentro del rango del tipo;
- `Float`, `Double`: número finito;
- `String`: hasta 256 caracteres; la cadena vacía es un valor válido;
- además, si el mapeo tiene `min`/`max`, el valor debe estar dentro.

**Receta completa.** Una receta está completa si tiene un valor válido para cada variable de receta actual y ningún valor de más. Al crearla o editarla siempre lo está (si no, se rechaza). Puede dejar de estarlo después, si cambian las variables de la categoría (ver casos borde).

## Backend

### Flujo principal (Given/When/Then)

**Consultar las variables de receta**

- **When** cualquiera de los tres roles llama a `GET /api/v1/machines/:machineId/recipe-variables`.
- **Then** responde `200`:
  ```json
  {
    "category": { "id": "…", "name": "Programación para la receta" },
    "variables": [
      {
        "signalVariableName": "rEspiras",
        "dataType": "Float",
        "comment": null,
        "min": null,
        "max": null
      },
      {
        "signalVariableName": "xSentidoCabezal",
        "dataType": "Boolean",
        "comment": "2 opciones: 0 - Horario / 1 - Antihorario",
        "min": null,
        "max": null
      }
    ],
    "excludedCount": 2
  }
  ```
  Si la Machine no tiene la categoría, `category` es `null` y `variables` está vacío.

**Listado y buscador**

- **When** se llama a `GET /api/v1/machines/:machineId/recipes?search=espir&limit=20&offset=0`.
- **Then** responde `200` con la paginación estándar ([11-api-rest.md](../11-api-rest.md), "Paginación"). Cada elemento lleva `id`, `title`, `description`, `isActivated`, `activatedAt`, `isComplete`, `updatedAt` y `updatedByEmail`.
- **And** `search` (opcional, hasta 100 caracteres) filtra las recetas cuyo título **o** descripción contienen el texto, sin distinguir mayúsculas ni tildes («programacion» encuentra «Programación»).
- **And** el orden es: primero la receta activa y después las demás por `updatedAt`, de la más reciente a la más antigua.

**Crear**

- **When** se llama a `POST /api/v1/machines/:machineId/recipes` con el título, la descripción opcional y **un valor para cada variable de receta**:
  ```json
  {
    "title": "Bobina 120 mm hilo 0,5",
    "description": "Cliente Norte",
    "values": [
      { "signalVariableName": "rEspiras", "value": 350 },
      { "signalVariableName": "rDiametroHilo", "value": 0.5 },
      { "signalVariableName": "xSentidoCabezal", "value": false }
    ]
  }
  ```
  (en el ejemplo solo se muestran tres de los valores).
- **Then** valida título y valores, guarda la receta con `isActivated: false`, `version: 1` y el email del usuario, y responde `201` con la receta completa.

**Consultar y editar**

- **When** se llama a `GET /api/v1/machines/:machineId/recipes/:recipeId`.
- **Then** responde `200` con la receta, `isComplete` y, si no está completa, el detalle en `missingVariables` y `staleValues` (ver casos borde).

- **When** se llama a `PUT /api/v1/machines/:machineId/recipes/:recipeId` con `title`, `description`, `values` (otra vez, todos) y la `version` que se leyó.
- **Then** sustituye título, descripción y valores, sube `version`, actualiza `updatedAt`/`updatedByEmail` y responde `200`. La marca «Activa» no cambia al editar.

**Borrar**

- **When** se llama a `DELETE /api/v1/machines/:machineId/recipes/:recipeId`.
- **Then** la receta se elimina y responde `204`. Si era la activa, la Machine se queda sin receta activa.

**Activar y desactivar**

- **When** se llama a `POST /api/v1/machines/:machineId/recipes/:recipeId/activate` sobre una receta completa.
- **Then**, en una sola transacción, la receta pasa a `isActivated: true` con `activatedAt` y `activatedByEmail`, y la que estuviera activa en esa Machine pasa a `false`. Responde `200` con la receta.
- **And** no se comunica nada al PLC, no se publica ningún evento y no cambia nada más.

- **When** se llama a `POST /api/v1/machines/:machineId/recipes/:recipeId/deactivate`.
- **Then** la receta pasa a `isActivated: false` y responde `200`. La Machine se queda sin receta activa.

**Duplicar** no tiene endpoint propio: el Frontend abre el formulario de receta nueva con los valores de la original y el título «<título> (copia)», y se guarda con `POST`.

### Casos borde / errores (Given/When/Then)

**Validación**

- `title` vacío o de más de 120 caracteres, `description` de más de 500, `search` de más de 100, o un campo no declarado: `400` con el formato estándar de validación de payload ([11-api-rest.md](../11-api-rest.md), "Validación de payloads").
- Un título que ya usa otra receta de la Machine, aunque cambien mayúsculas o tildes («Bobina A» y «bobina á»): `409 RECIPE_TITLE_TAKEN`.
- `values` con problemas: `400 INVALID_RECIPE_VALUES`, con `details: [{ signalVariableName, reason }]`, donde `reason` es:
  - `MISSING`: falta el valor de una variable de receta (todas son obligatorias);
  - `NOT_A_RECIPE_VARIABLE`: la variable no es de receta;
  - `DUPLICATED`: la variable aparece dos veces;
  - `TYPE_MISMATCH`: el valor no cumple el tipo;
  - `OUT_OF_RANGE`: el valor está fuera de los límites (con `min`/`max` en el detalle).
- La Machine no tiene la categoría «Programación para la receta», o no tiene ninguna variable de receta: `POST` y `PUT` responden `409 RECIPE_VARIABLES_NOT_AVAILABLE`. `GET`, `DELETE` y desactivar siguen funcionando.
- La Machine ya tiene 500 recetas: `POST` responde `409 RECIPE_LIMIT_REACHED`.

**Ediciones simultáneas**

- **Given** dos usuarios que abren la misma receta (`version: 3`).
- **When** el primero guarda (pasa a `version: 4`) y después guarda el segundo con `version: 3`.
- **Then** el segundo recibe `409 RECIPE_MODIFIED` y no se sobrescribe nada.
- Activar o desactivar no cambia `version`: no es una edición del contenido.

**Recetas que dejan de estar completas**

- **Given** una receta guardada.
- **When** después cambian las variables de la categoría (se reimporta la GVL, se sincronizan variables con la spec 21, cambia el mapeo o sus límites).
- **Then**:
  - las variables de receta nuevas para las que no hay valor salen en `missingVariables`;
  - los valores que ya no corresponden a una variable de receta, o que ya no cumplen su tipo o sus límites, salen en `staleValues: [{ signalVariableName, value, reason }]` y se quitan de `values`;
  - `isComplete` es `false`;
  - la receta se sigue pudiendo consultar, duplicar, borrar y desactivar, y para guardarla hay que completarla.
- **And** una receta incompleta **no se puede activar**: `409 RECIPE_INCOMPLETE`. Si ya estaba activa, sigue activa, y el listado la marca como incompleta.

**Activación**

- Activar la receta que ya está activa: `200`, sin cambios.
- Desactivar una receta que no está activa: `200`, sin cambios.
- Dos activaciones simultáneas de recetas distintas en la misma Machine: se ejecutan una detrás de otra (la activación bloquea la fila de la Machine) y gana la última; además, un índice único parcial garantiza que nunca hay dos activas.

**Acceso**

- Una Machine de otra Company, inexistente o inactiva, o una receta de otra Machine: `404`, como en el resto de la API.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección nueva "Recipes":

| Método | Ruta                                                       | Roles    |
| ------ | ---------------------------------------------------------- | -------- |
| GET    | `/api/v1/machines/:machineId/recipe-variables`             | Los tres |
| GET    | `/api/v1/machines/:machineId/recipes`                      | Los tres |
| POST   | `/api/v1/machines/:machineId/recipes`                      | Los tres |
| GET    | `/api/v1/machines/:machineId/recipes/:recipeId`            | Los tres |
| PUT    | `/api/v1/machines/:machineId/recipes/:recipeId`            | Los tres |
| DELETE | `/api/v1/machines/:machineId/recipes/:recipeId`            | Los tres |
| POST   | `/api/v1/machines/:machineId/recipes/:recipeId/activate`   | Los tres |
| POST   | `/api/v1/machines/:machineId/recipes/:recipeId/deactivate` | Los tres |

Todas las rutas llevan su decisión de roles explícita, cubierta por `route-permissions.spec.ts`: permiten al `Operador` a propósito.

### Criterios de aceptación backend

1. `GET /recipe-variables` devuelve, en el orden de la GVL, las variables de la categoría «Programación para la receta» (encontrada por nombre sin distinguir mayúsculas ni tildes) que están mapeadas con un tipo escalar soportado, con `dataType`, `comment`, `min` y `max`, y cuenta las excluidas. Sin esa categoría, devuelve `category: null` y ninguna variable.
2. Los tres roles crean, consultan, editan, borran, activan y desactivan recetas de las Machines de su Company. Una Machine o receta ajena da `404`.
3. El título es único por Machine sin distinguir mayúsculas ni tildes (`409 RECIPE_TITLE_TAKEN`).
4. Crear y editar exigen un valor para **cada** variable de receta, validado contra su tipo y sus límites, sin variables de más ni repetidas (`400 INVALID_RECIPE_VALUES` con el detalle por variable).
5. El buscador filtra por título o descripción sin distinguir mayúsculas ni tildes, con la paginación estándar, y pone la receta activa la primera.
6. Activar deja exactamente una receta activa en la Machine, también con peticiones simultáneas, y solo se permite con la receta completa (`409 RECIPE_INCOMPLETE`). Activar o desactivar no se comunica con el PLC ni publica eventos.
7. Guardar con una `version` antigua da `409 RECIPE_MODIFIED` sin sobrescribir.
8. Si cambian las variables de la categoría, la receta se devuelve con `isComplete: false`, `missingVariables` y `staleValues`, y se puede consultar, duplicar, borrar y desactivar.
9. Las recetas no generan lecturas ni escrituras en el PLC, ni puntos en InfluxDB.
10. Cobertura ≥ 80 % en Entities y Use Cases. La validación de valores, el cálculo de completitud y la normalización de nombres y títulos son funciones puras con tests unitarios.

### Pruebas

- **Unitarias**: validación de valores por tipo y límites, normalización de títulos y del nombre de la categoría, cálculo de variables de receta, de `missingVariables` y de `staleValues`, y los casos de uso con repositorios falsos.
- **Integración** (un test por flujo, contra PostgreSQL real): crear → buscar con y sin tildes → editar con `version` antigua (`409`) → activar dos recetas seguidas (queda una) → reimportar la GVL con una variable nueva en la categoría (la receta pasa a incompleta y no se puede activar).
- **E2E** (Playwright): el test prepara por API una Machine con `nodeMapping` y categorías importadas (no hace falta conexión con el PLC). Después un `Operador` crea una receta, la busca, la duplica y la activa.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

**Listado y buscador**

- **Given** cualquiera de los tres roles.
- **When** pulsa «Recetas» en el Sidebar.
- **Then** ve un selector de Machine (las de su Company; se recuerda la última elegida) y, debajo, la tabla de recetas de esa Machine: título, descripción, estado (etiquetas «Activa» e «Incompleta»), última modificación (fecha y email) y acciones.
- **When** escribe en el buscador.
- **Then** la tabla se filtra (300 ms después de dejar de escribir), vuelve a la primera página y muestra «Sin resultados para "<texto>"» si no hay coincidencias.

**Crear y editar**

- **When** pulsa «Nueva receta».
- **Then** se abre el formulario con título, descripción y la lista de variables de receta en el orden de la GVL. Cada fila muestra el nombre, la descripción importada como texto de ayuda y un control según el tipo:
  - `Boolean`: un interruptor (`role="switch"`), que empieza en «No» (`false`);
  - enteros y reales: un campo numérico, vacío al empezar, con `min`/`max` si existen;
  - `String`: un campo de texto.
- **And** todos los campos son obligatorios. Un contador indica «X de Y variables con valor», y un filtro sobre la lista ayuda a encontrar una variable entre las 53.
- **When** pulsa «Guardar».
- **Then** la app valida en el cliente (título, valores obligatorios, tipos, límites), llama a `POST` o `PUT`, muestra un toast y vuelve al listado.

**Duplicar**

- **When** pulsa «Duplicar» en una receta.
- **Then** se abre el formulario de receta nueva con sus valores y el título «<título> (copia)». No se crea nada hasta pulsar «Guardar».

**Activar**

- **When** pulsa «Activar» en una receta.
- **Then**:
  - si ya hay otra activa, un diálogo pide confirmación: «La receta "<otra>" dejará de estar activa»;
  - tras activarla, la tabla muestra la etiqueta «Activa» en ella y se muestra un toast: «Receta marcada como activa. Por ahora no se envía nada a la máquina».
- **When** pulsa «Desactivar» en la receta activa.
- **Then** la etiqueta desaparece y se muestra un toast.

**Borrar**

- **When** pulsa «Eliminar».
- **Then** un diálogo pide confirmación; si es la receta activa, avisa además de que la Machine se quedará sin receta activa. Tras confirmar, desaparece de la tabla y se muestra un toast.

### Casos borde / errores de UI

- **Machine sin la categoría «Programación para la receta»**: en lugar del formulario y del botón «Nueva receta» aparece un mensaje: «Esta máquina no tiene la categoría "Programación para la receta". Importa las categorías de la GVL». Para `AdminCliente`/`SuperAdmin` lleva un enlace a la pantalla de categorías (spec 23); el `Operador` ve «Pide a un administrador que importe las categorías». Si ya hay recetas guardadas, se siguen listando.
- **Campos sin rellenar o inválidos**: cada fila con error muestra el mensaje junto a su control («Obligatorio», «Debe ser un número entero entre 0 y 65535», «Máximo 500») y el foco va a la primera con error. Si el error viene del Backend (`400 INVALID_RECIPE_VALUES`), se marcan las filas de `details`.
- **Título repetido** (`409 RECIPE_TITLE_TAKEN`): error en el campo título, sin perder lo escrito.
- **Edición simultánea** (`409 RECIPE_MODIFIED`): un diálogo avisa de que otra persona ha guardado cambios y ofrece «Recargar la receta» (descarta los cambios propios) o «Seguir editando» (para copiarlos a mano).
- **Receta incompleta**: al abrirla, un aviso al principio del formulario lista las variables nuevas que faltan y los valores que se quitarán al guardar; las filas que faltan se marcan como obligatorias. En el listado, «Activar» está deshabilitado con el texto «Complétala antes de activarla».
- **Cambios sin guardar**: salir del formulario con cambios pide confirmación.

### Componentes/pantallas involucrados

Referencia: [08-frontend-dashboard.md](../08-frontend-dashboard.md) §8.6 (configuración desde el Frontend) y [12-convenciones-frontend.md](../12-convenciones-frontend.md).

- Nueva área `recipes/` (`entities`, `adapters`, `use-cases`, `components`, `pages`), fuera de `config` porque la usan los tres roles, como `write-packages/` (spec 20):
  - `recipes-page`: ruta `/recetas`, con selector de Machine, buscador, tabla paginada y acciones;
  - `recipe-form-page`: rutas `/recetas/:machineId/nueva` (también para duplicar) y `/recetas/:machineId/:recipeId`;
  - `recipe-value-field` (componente): el control de cada variable según su tipo, con su error. Tiene estado (valor y validación), así que es un componente (regla 12.4).
- Sidebar ([12-navegacion-shell.md](12-navegacion-shell.md)): entrada «Recetas» para los tres roles, con un icono de Iconsax Essential.
- Se reutilizan la tabla, el input, el toast, el diálogo de confirmación, el badge y la paginación existentes.

### Criterios de aceptación frontend

1. «Recetas» aparece en el Sidebar para los tres roles y la pantalla lista las recetas de la Machine elegida, con la activa marcada y en primer lugar, y las incompletas señaladas.
2. El buscador filtra por título o descripción, sin distinguir tildes, y vuelve a la primera página.
3. El formulario muestra todas las variables de receta en el orden de la GVL, con la descripción como ayuda y un control según el tipo (interruptor accesible para `Boolean`, numérico con límites y texto). Todas son obligatorias y no se puede guardar con alguna vacía.
4. Los errores de validación se muestran en cada fila, accesibles (`aria-invalid`, mensaje asociado con `aria-describedby`), y el foco va a la primera con error.
5. «Duplicar» abre el formulario con los valores de la original y el título «(copia)», sin crear nada hasta guardar.
6. Activar pide confirmación si ya hay otra activa e indica que no se envía nada a la máquina; desactivar quita la marca. Una receta incompleta no se puede activar.
7. Borrar pide confirmación, y avisa si es la receta activa.
8. Un `409 RECIPE_MODIFIED` ofrece recargar o seguir editando; un `409 RECIPE_TITLE_TAKEN` marca el título.
9. Sin la categoría «Programación para la receta» se muestra el mensaje según el rol y no se puede crear.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

- **A01 Control de acceso**: todas las rutas resuelven la Machine con el `MachineAccessResolver` (otra Company → `404`). Una receta solo se busca dentro de su Machine. El `Operador` tiene acceso completo a las recetas de su Company, por decisión explícita.
- **A03 Inyección**: el buscador usa consultas parametrizadas; `%` y `_` del texto se escapan para que no actúen como comodines.
- **A04 Diseño inseguro**:
  - límites de tamaño (título, descripción, búsqueda, 256 caracteres por `String`) y de 500 recetas por Machine;
  - solo se aceptan valores de variables de receta, validados por tipo y límites;
  - las recetas no se comunican con el PLC: el riesgo de escritura sigue acotado a los paquetes de la spec 20 hasta la spec de carga en la máquina.
- **Mass assignment**: DTOs con `whitelist`/`forbidNonWhitelisted`. `isActivated`, `version` (salvo como comprobación en `PUT`) y los campos de auditoría no se aceptan en el cuerpo.

## Fuera de alcance

- **Cargar la receta en la máquina** (escribir sus valores en el PLC) y cualquier efecto de la marca «Activa». Será una spec posterior.
- **Variables de notificación** (`xCmd…` de «Comandos para la gestión de los datos de la receta») que avisan al PLC de los valores cambiados. Van con la carga en la máquina.
- **Excluir de la receta variables que no son datos**, como `xRecetaActualizaHMI` o `xIrPosicionInicial`/`xIrPosicionFinal` (mueven un eje). Hoy entran todas las de la categoría; se decidirá en la spec de carga, que es cuando importa porque se escriben en el PLC.
- Leer valores del PLC para crear una receta.
- **Límites leídos del PLC** («Límites de los datos de la receta», `rMinEspiras`/`rMaxEspiras`…) para validar los valores.
- **Desplegables a partir de las descripciones** («3 opciones: 0 - Continuar / 1 - …»): de momento la descripción se muestra como texto de ayuda.
- Historial de versiones o de cambios de las recetas, papelera y deshacer.
- Importar o exportar recetas, y sincronizarlas con el archivo de recetas del propio PLC («Página archivo recetas»).
