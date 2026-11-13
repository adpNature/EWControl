# Spec: Añadir una carpeta OPC UA entera desde el explorador de nodos

## Contexto

En la pantalla «Conexión» de una Machine OPC UA ([18-integracion-opc-ua.md](18-integracion-opc-ua.md)), el explorador de nodos solo permite añadir las variables al mapeo una a una. Con el PLC actual (CODESYS, `GVL_HMI` con 450 escalares) eso no es práctico.

La pantalla «Variables OPC UA» ([21-sincronizacion-variables-opc-ua.md](21-sincronizacion-variables-opc-ua.md)) ya sabe recorrer una carpeta entera por lotes y devolver sus variables escalares mapeables. Esta spec reutiliza esa sincronización desde el árbol de «Conexión»: un botón **«Añadir todas»** en cada carpeta añade al mapeo del formulario todas las variables escalares que cuelgan de ella, incluidas las de subcarpetas y los elementos de arrays.

De paso corrige un fallo del explorador de la spec 18: los arrays mostraban «Añadir» como si fueran una variable suelta.

No añade endpoints ni cambia el modelo: es una spec **solo de frontend**.

## Actor(es)

`AdminCliente` y `SuperAdmin` (roles de configuración). El `Operador` no accede a «Conexión».

## Precondiciones

- La Machine tiene **guardada** una conexión `OpcUa`, y el endpoint del formulario es el mismo que el guardado. La sincronización de la spec 21 siempre usa el endpoint guardado (protección SSRF), así que con un endpoint nuevo hay que guardar antes.
- El usuario ha pulsado «Explorar nodos» y el árbol está cargado.

## Backend

Sin cambios. Se usa `POST /api/v1/machines/:machineId/connection/opcua/variables/sync` de la spec 21 tal cual, con sus límites (2000 variables, profundidad 8, 60 s), sus errores y sus permisos. Es una operación de solo lectura en el PLC y no guarda nada.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

**Añadir una carpeta**

- **Given** el árbol de «Conexión» con la carpeta `GVL_HMI` visible.
- **When** el usuario pulsa «Añadir todas» en esa carpeta.
- **Then**:
  - El botón pasa a «Añadiendo…» y queda deshabilitado (`aria-busy`) hasta que llega la respuesta. Los demás «Añadir todas» también se deshabilitan mientras tanto.
  - La app llama a `.../opcua/variables/sync` con `rootNodeId` = el NodeId de la carpeta.
  - Añade al final de «Variables mapeadas» cada variable de `variables` cuyo `nodeId` aún no esté en el mapeo, con:
    - `signalVariableName` derivado de su ruta, igual que en la spec 21 (`GVL_HMI_xMarcha`, `GVL_HMI_axManualAvance_0`);
    - su `dataType`.
  - Muestra un toast de éxito: «Añadidas 450 variables de GVL_HMI. Pulsa Guardar para aplicar los cambios.», con «N ya estaban en el mapeo» y «M omitidas (arrays o tipos no soportados)» cuando correspondan.
  - Nada se guarda hasta que el usuario pulsa «Guardar», como al añadir una variable suelta.

**Dónde aparece el botón**

- **Given** un nodo del árbol.
- **Then** «Añadir todas» aparece en los nodos que se pueden desplegar (`hasChildren`) y no son mapeables por sí mismos: carpetas (`Object`) y Variables con hijos (arrays, estructuras). En un array añade sus elementos.

**Arrays (corrección de la spec 18)**

- **Given** una Variable con hijos, como un array `awIPaddressHMI` de tipo `UInt16`.
- **Then** **no** muestra «Añadir», aunque su tipo sea mapeable: se despliega y se añaden sus elementos (`awIPaddressHMI[0]`…), uno a uno o con «Añadir todas».

### Casos borde / errores de UI

- **Conexión no guardada o endpoint distinto**: si la Machine no tiene guardada una conexión `OpcUa`, o el endpoint del formulario no coincide con el guardado, los botones «Añadir todas» se muestran deshabilitados. Sobre el árbol aparece un aviso: «Para añadir carpetas enteras, guarda primero la conexión con este endpoint.»
- **Todas ya mapeadas**: si todas las variables de la carpeta ya estaban en el mapeo, no se añade nada y se muestra un toast informativo: «Todas las variables de GVL_HMI ya estaban en el mapeo.»
- **Carpeta sin variables mapeables**: toast informativo: «GVL_HMI no tiene variables escalares que se puedan mapear.»
- **Límite del mapeo**: si las nuevas filas harían que el mapeo superase las 500 entradas, no se añade ninguna. Toast de error: «Añadir 450 variables superaría el máximo de 500 del mapeo (ya hay 120).»
- **Nombres repetidos**: si un identificador derivado coincide con el de otra fila, la fila se añade igualmente y la validación existente de la tabla la marca como «Nombre repetido en otra fila», como en la spec 18.
- **Errores de la sincronización**: se muestran en un toast con los mismos mensajes que la pantalla «Variables OPC UA»: endpoint inalcanzable, carpeta inexistente, demasiadas variables (más de 2000) o tiempo agotado.

### Componentes/pantallas involucrados

- `OpcUaNodeBrowserComponent` (`config/components/opc-ua-node-browser/`):
  - botón «Añadir todas» y evento de salida con el nodo;
  - entradas para deshabilitar los botones y marcar el que está en curso;
  - «Añadir» oculto en nodos con hijos.
- `MachineConnectionPage` (`config/pages/machine-connection-page/`): llama a la sincronización y añade las filas.
- Función pura nueva en `config/use-cases/` que, a partir de la respuesta de la sincronización y del mapeo actual, calcule las filas nuevas, cuántas ya estaban y si se supera el límite. Reutiliza `deriveIdentifierFromPath` de la spec 21.

### Criterios de aceptación frontend

1. Los nodos con hijos (carpetas y Variables con hijos) muestran «Añadir todas». Los escalares mapeables muestran «Añadir» y no «Añadir todas».
2. Una Variable con hijos no muestra «Añadir» aunque su tipo sea mapeable.
3. Pulsar «Añadir todas» llama a la sincronización con el NodeId del nodo y añade al mapeo solo las variables que no estaban, con el identificador derivado de su ruta y su `dataType`, sin guardar.
4. Mientras dura la petición, el botón pulsado muestra «Añadiendo…» y todos los «Añadir todas» están deshabilitados.
5. El toast de éxito indica cuántas se han añadido y, si las hay, cuántas ya estaban y cuántas se han omitido.
6. Si el mapeo resultante superase 500 entradas, no se añade ninguna y se muestra el error con las cifras.
7. Si todas ya estaban, o la carpeta no tiene variables mapeables, no se añade nada y se informa.
8. Sin conexión `OpcUa` guardada, o con un endpoint distinto del guardado, los botones están deshabilitados y se muestra el aviso.
9. Un error de la sincronización se muestra en un toast con el mensaje de la spec 21.
10. Los botones son accesibles: nombre accesible «Añadir todas las variables de <carpeta>», y `tabindex="-1"` dentro del `treeitem`, como el «Añadir» existente.

## Seguridad (OWASP Top 10, [06-seguridad-global.md](../06-seguridad-global.md))

Sin superficie nueva:

- **A01**: el endpoint de la spec 21 ya exige rol de configuración y tenencia de la Machine.
- **A10**: usa siempre el endpoint guardado, no el del formulario. Por eso la precondición exige guardar antes.
- **A04**: los límites de la sincronización (2000 variables, 60 s) y del mapeo (500) siguen aplicándose. El de 500 se comprueba también en el frontend antes de añadir.

## Fuera de alcance

- Etiquetas y aviso de cambios en sucesivas sincronizaciones: siguen siendo exclusivos de la pantalla «Variables OPC UA».
- Elegir un subconjunto de variables de la carpeta antes de añadirlas: se añaden todas y se pueden quitar fila a fila.
- Sincronizar contra un endpoint todavía no guardado.
