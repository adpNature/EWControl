# Spec: Categorías de variables del PLC (importadas de la GVL)

## Contexto

Con la sincronización por carpetas ([21-sincronizacion-variables-opc-ua.md](21-sincronizacion-variables-opc-ua.md) y [22-anadir-carpeta-opc-ua-desde-explorador.md](22-anadir-carpeta-opc-ua-desde-explorador.md)), una Machine puede tener cientos de variables, por ejemplo las ~430 de `GVL_HMI`. Hoy aparecen como una lista plana y no hay forma de saber a qué pantalla o función del HMI pertenece cada una.

El programador del PLC ya las tiene organizadas. En CODESYS, la GVL se exporta a CSV (`Type,Name,Address,DataType,InitValue,Comment,Attribute`) y los comentarios llevan títulos enmarcados:

- un título entre líneas `####…` es una **categoría** (por ejemplo «PAGINA PROGRAMACIÓN RECETA»);
- un título entre líneas `****…` es una **subcategoría** de la última categoría (por ejemplo «PROGRAMACION PARA LA RECETA»);
- el título se aplica a la variable que lo lleva y a todas las siguientes, hasta el siguiente título;
- un comentario sin marco es la **descripción** de esa variable sola (por ejemplo `xCmdBobinadoHome` → «Home»).

Esta spec permite **importar** ese CSV en una Machine para crear su árbol de categorías (dos niveles) y asignar cada variable a su categoría. Después las categorías se pueden **renombrar**. Las categorías organizan las variables en «Variables OPC UA» y en las sugerencias del formulario de Signal.

Las categorías son solo organizativas: no cambian qué se lee del PLC, ni qué variables se pueden usar en Signals, fórmulas o paquetes de escritura.

## Actor(es)

`AdminCliente` y `SuperAdmin` (roles de configuración). El `Operador` no accede a estas pantallas ni a sus endpoints.

## Precondiciones

- La Machine existe, pertenece a la Company del usuario (o este es `SuperAdmin`) y está activa.
- Se dispone de la exportación CSV de la GVL y del NodeId de su carpeta en el servidor OPC UA (por ejemplo `ns=4;s=|var|<PLC>.Application.GVL_HMI`).

## Modelo

- `VariableCategory` (tabla `variable_categories`): `id`, `machineId`, `parentId` (`null` en las categorías raíz), `name` (1–120 caracteres), `position` (orden del CSV). Dos niveles como máximo.
- `VariableCatalogEntry` (tabla `variable_catalog_entries`), clave `machineId` + `nodeId`:
  - `categoryId`: la subcategoría o, si no la hay, la categoría; `null` si la variable va antes del primer título;
  - `comment`: descripción libre o `null`;
  - `position`: orden en el CSV.
- El `nodeId` de cada variable es `<NodeId de la carpeta>.<Name>`, como lo expone CODESYS. Los elementos de un array (`…GVL_HMI.asCtrl[0]`) heredan la categoría y la descripción del array.
- Borrar la Machine físicamente (purga de Company, spec 10) borra sus categorías y su catálogo (`ON DELETE CASCADE`).

### Nombres al importar

Los títulos del CSV vienen en mayúsculas. Al importar se pasan a minúsculas con la primera letra en mayúscula, salvo las siglas conocidas (`HMI`, `PLC`, `IP`, `CPU`): «PAGINA ESTADO BOBINADO» → «Pagina estado bobinado». Las tildes o erratas que falten en el CSV («PAGINA», «ICONOOS») se corrigen después renombrando.

## Backend

### Flujo principal (Given/When/Then)

**Importar**

- **Given** una Machine y la exportación CSV de `GVL_HMI`.
- **When** `POST /api/v1/machines/:machineId/variable-categories/import` con `{ "rootNodeId": "ns=4;s=|var|<PLC>.Application.GVL_HMI", "csv": "<contenido>" }`.
- **Then**:
  - se borran las categorías y el catálogo anteriores de esa Machine y se crean los nuevos, todo en una transacción;
  - `200` con el resumen: `{ "categories": 8, "subcategories": 16, "variables": 428, "categorized": 408, "uncategorized": 20, "withComment": 70 }`.

**Listar**

- **When** `GET /api/v1/machines/:machineId/variable-categories`.
- **Then** `200` con:
  - `categories`: `[{ id, parentId, name, position, variableCount }]`, en orden;
  - `variables`: `[{ nodeId, categoryId, comment, position }]`.
  - Sin importar nada, las dos listas vienen vacías.

**Renombrar**

- **When** `PATCH /api/v1/machines/:machineId/variable-categories/:categoryId` con `{ "name": "Página programación receta" }`.
- **Then** `200` con la categoría actualizada. El nombre se guarda recortado (sin espacios al principio ni al final).

### Casos borde / errores (Given/When/Then)

- **CSV no válido**: sin las columnas `Name` y `Comment`, sin ninguna variable, con comillas sin cerrar, o con nombres de variable no válidos → `400 INVALID_GVL_EXPORT` con `details.reason`. No se borra nada.
- **Límites** (OWASP A04): `csv` de 90.000 caracteres como máximo (el DTO lo rechaza con `400`), 5000 variables y 300 categorías como máximo → `400 INVALID_GVL_EXPORT`.
- **`rootNodeId` vacío o de más de 1024 caracteres** → `400`.
- **Título repetido**: dos bloques `####` con el mismo título crean dos categorías distintas. No se fusionan, para respetar el orden del CSV.
- **Subcategoría sin categoría previa**: se crea como categoría raíz.
- **Renombrar con un nombre vacío o de más de 120 caracteres** → `400 INVALID_VARIABLE_CATEGORY_NAME`.
- **Renombrar con el nombre de otra categoría del mismo padre** → `409 VARIABLE_CATEGORY_NAME_TAKEN`.
- **Categoría inexistente o de otra Machine** → `404 VARIABLE_CATEGORY_NOT_FOUND`.
- **Machine inexistente o de otra Company** → `404 MACHINE_NOT_FOUND`. **Machine desactivada** → `422 MACHINE_INACTIVE`.
- **Operador** → `403` en los tres endpoints.

### Contrato de entrada/salida

Ver [11-api-rest.md](../11-api-rest.md), sección «Categorías de variables».

### Criterios de aceptación backend

1. El parser reconoce categorías (`####`), subcategorías (`****`) y descripciones (comentarios sin marco), y asigna a cada variable la última categoría y subcategoría vistas. Las variables anteriores al primer título quedan sin categoría.
2. El parser soporta campos entre comillas con saltos de línea y comillas dobladas (`""`), y exige las columnas `Name` y `Comment`.
3. Los títulos se normalizan a minúsculas con mayúscula inicial, conservando las siglas conocidas y colapsando los espacios.
4. Importar sustituye en una transacción todas las categorías y el catálogo de la Machine, y devuelve el resumen.
5. Un CSV no válido o por encima de los límites da `400 INVALID_GVL_EXPORT` sin modificar nada.
6. Listar devuelve las categorías en orden, con su número de variables, y el catálogo.
7. Renombrar valida longitud y unicidad entre hermanas, y responde `404` si la categoría no es de esa Machine.
8. Los tres endpoints exigen `@roles(...CONFIGURATION_ROLES)` y tenencia de la Machine.
9. Cobertura ≥ 80 % en Entities y Use Cases.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

**Pantalla «Categorías»** (`/config/machines/:machineId/variable-categories`, enlazada desde el detalle de la Machine junto a «Variables OPC UA»)

- **Importar**:
  - **Given** el formulario «Importar desde CSV», con el campo «Carpeta OPC UA (NodeId)» (por defecto, la carpeta guardada de «Variables OPC UA») y un selector de fichero `.csv`.
  - **When** el usuario elige el fichero y pulsa «Importar».
  - **Then**:
    - si ya hay categorías, se pide confirmación: «Se sustituirán las categorías actuales y sus nombres»;
    - el fichero se lee en UTF-8 o, si no lo es, en Windows-1252 (como exporta CODESYS);
    - tras importar, un toast resume: «8 categorías, 16 subcategorías y 428 variables (20 sin categoría)», y el árbol se recarga.
- **Árbol**:
  - lista las categorías con sus subcategorías debajo, cada una con su número de variables;
  - cada una tiene un campo con su nombre y un botón «Guardar», habilitado cuando el nombre cambia;
  - al guardar se muestra un toast; si hay un error (`409`, `400`), se muestra en la fila.

**Variables OPC UA**

- Nueva columna **Categoría**, con «Categoría › Subcategoría» o «—».
- Nuevo filtro **Categoría**: «Todas», «Sin categoría» y cada categoría y subcategoría (`optgroup` por categoría). Elegir una categoría incluye sus subcategorías.
- Las filas sin etiqueta proponen como etiqueta la descripción del CSV. Solo se propone: se guarda al pulsar «Guardar», como cualquier otra edición.

**Formulario de Signal**

- Las sugerencias de variable se ordenan según las categorías (orden del CSV) y, después, las variables sin categoría.
- Cada sugerencia muestra «Categoría › Subcategoría · etiqueta» (o la descripción del CSV si no hay etiqueta).

### Casos borde / errores de UI

- **Sin categorías importadas**: la pantalla «Categorías» explica cómo importar; «Variables OPC UA» muestra «—» y el filtro solo ofrece «Todas»; el formulario de Signal funciona como antes.
- **Error al importar**: alerta con el motivo («El CSV no tiene la columna Comment», «Más de 5000 variables»…). El árbol actual no cambia.
- **Fichero vacío o no CSV**: el botón «Importar» queda deshabilitado hasta elegir un `.csv`.
- **Error al cargar las categorías**: «Variables OPC UA» y el formulario de Signal siguen funcionando, sin categorías.

### Componentes/pantallas involucrados

- `config/entities/variable-category.model.ts` y `config/adapters/variable-categories-api.service.ts`.
- `config/use-cases/variable-categories.ts`:
  - árbol;
  - ruta «Categoría › Subcategoría» de un `nodeId` (con elementos de array);
  - opciones del filtro;
  - orden de las sugerencias;
  - decodificación del fichero.
- `pages/machine-variable-categories-page/` (nueva), su ruta y su breadcrumb («Machines › máquina › Categorías»).
- `MachineDetailPage`: botón «Categorías» para roles de configuración.
- `MachineOpcUaVariablesPage` y `SignalFormPage`.

### Criterios de aceptación frontend

1. «Categorías» importa el CSV con la carpeta indicada, pide confirmación si ya hay categorías y muestra el resumen.
2. El árbol muestra categorías y subcategorías con su número de variables; renombrar envía el `PATCH` y actualiza el árbol; los errores se muestran en la fila.
3. El fichero se decodifica en UTF-8 o, si no es válido, en Windows-1252.
4. «Variables OPC UA» muestra la categoría de cada fila (también de los elementos de array) y filtra por categoría (incluidas sus subcategorías) o «Sin categoría».
5. Las filas sin etiqueta proponen la descripción del CSV.
6. El formulario de Signal ordena las sugerencias por categoría y muestra la ruta de la categoría en cada una.
7. Accesibilidad:
   - campos con `label`;
   - cada campo de nombre del árbol con nombre accesible «Nombre de la categoría <nombre>»;
   - errores con `role="alert"`;
   - árbol como lista anidada (`ul`/`li`) con encabezado.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

- **A01**: los tres endpoints exigen rol de configuración (`route-permissions.spec.ts`) y pasan por `MachineAccessResolver` (tenencia de Company). La categoría se busca siempre dentro de la Machine de la URL.
- **A03**: el CSV se parsea sin evaluar nada. Los nombres y las descripciones se guardan como texto y Angular los escapa al mostrarlos. Consultas parametrizadas vía TypeORM.
- **A04**: límites de tamaño del CSV (90.000 caracteres, por debajo del límite de 100 KB del body), de variables y de categorías. La importación es atómica.
- **A08**: el CSV solo crea categorías y descripciones; nunca modifica el `nodeMapping` ni escribe en el PLC.

## Fuera de alcance

- Crear, borrar o mover categorías a mano, o cambiar la categoría de una variable concreta. Se hace reimportando el CSV.
- Más de dos niveles.
- Filtrar por categoría en «Conexión» o en el Dashboard.
- Exportaciones de otros fabricantes (por ejemplo, tablas de TIA Portal).
