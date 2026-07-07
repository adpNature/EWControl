# 0. Metodología y Calidad

## Introducción

Este documento fija cómo se trabaja en EWControl, no qué se construye.

Su objetivo es evitar dos riesgos habituales en proyectos que empiezan desde cero: programar sin haber acordado antes qué se espera de cada funcionalidad, y dejar que la documentación se desactualice en cuanto el código empieza a cambiar.

Estas reglas aplican a todo el desarrollo, presente y futuro, tanto en backend como en frontend.

---

# Spec-Driven Development

Ninguna funcionalidad se programa sin una spec previa.

Una spec es un documento corto en `docs/specs/` que describe, antes de escribir código, qué tiene que hacer una funcionalidad, quién la usa y cómo se sabe que está terminada.

## Flujo de trabajo

1. Se escribe la spec de la funcionalidad en `docs/specs/`.
2. Se revisa la spec (con el equipo o con el usuario) antes de tocar código.
3. Se escriben los tests a partir de los criterios de aceptación de la spec (ver TDD).
4. Se implementa hasta que los tests pasan.

La spec es la fuente de verdad. Si durante la implementación se descubre que la spec estaba equivocada o incompleta, se corrige la spec primero y después el código.

## Specs verticales

A partir de la fundación del proyecto (Simulador y catálogo de API, que no tienen interfaz propia), cada nueva funcionalidad se especifica como una **feature vertical**: una única spec que cubre tanto el backend como el frontend de esa funcionalidad, y que se implementa como una sola entrega.

La plantilla de spec y las specs actuales viven en `docs/specs/`.

---

# Clean Architecture

EWControl sigue los principios de Clean Architecture tanto en backend como en frontend.

## Regla de dependencia

El código de las capas internas nunca conoce el código de las capas externas. Las dependencias siempre apuntan hacia adentro.

Las capas internas contienen las reglas de negocio. Las capas externas contienen detalles: frameworks, bases de datos, protocolos de comunicación, interfaz de usuario.

## Capas canónicas

| Capa                 | Contiene                                                                                                                 | No conoce                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Entities             | Reglas de negocio puras, entidades del dominio                                                                           | Nada externo                     |
| Use Cases            | Orquestación de casos de uso de la aplicación                                                                            | Frameworks, bases de datos, UI   |
| Interface Adapters   | Traducción entre el mundo exterior y los casos de uso (controladores, presentadores, repositorios, proveedores de datos) | Detalles de frameworks concretos |
| Frameworks & Drivers | Frameworks, bases de datos, UI, dispositivos externos                                                                    | —                                |

El mapeo concreto de las capas ya existentes del proyecto (Domain, Application, Infrastructure, Adapters, Presentation) a esta nomenclatura canónica está detallado en:

- Backend: [02-arquitectura.md](02-arquitectura.md), sección "Equivalencia con Clean Architecture".
- Frontend: [08-frontend-dashboard.md](08-frontend-dashboard.md), sección "Equivalencia con Clean Architecture".

---

# Docs as Code

La documentación se versiona junto al código, en Markdown, dentro del propio repositorio (`docs/`).

Para evitar que quede desactualizada, se sigue una regla simple sobre dónde vive cada tipo de información:

## Qué vive en `docs/`

Contratos y decisiones que no cambian con cada refactor de implementación:

- Arquitectura y modelo de dominio.
- Contratos de API (endpoints, eventos, DTOs).
- Specs de funcionalidades.
- Decisiones de seguridad, despliegue y observabilidad.

## Qué vive inline en el código (TSDoc / JSDoc)

Detalle de implementación que cambia con el código:

- Qué hace una clase, método o función concretos.
- Parámetros, tipos de retorno, excepciones.
- Casos borde específicos de una implementación.

Todo método y clase pública debe llevar un comentario TSDoc/JSDoc que explique su propósito. Si la documentación de implementación vive junto al código, cambia en el mismo commit que el código y no se desincroniza.

## Regla práctica

Si al cambiar la implementación hay que actualizar el documento, esa información no debería estar en `docs/`, debería estar en el código.

---

# TDD

El desarrollo sigue el ciclo red-green-refactor:

1. **Red**: se escribe un test que falla, a partir de un criterio de aceptación de la spec.
2. **Green**: se escribe el código mínimo necesario para que el test pase.
3. **Refactor**: se mejora el código manteniendo los tests en verde.

## Relación con las specs

Cada criterio de aceptación de una spec (backend o frontend) se traduce en al menos un test. No se da por cerrada una spec hasta que todos sus criterios de aceptación tienen un test que los verifica.

## Cobertura

Las capas Entities y Use Cases, al concentrar las reglas de negocio, son las que requieren mayor cobertura de tests. Los detalles de Frameworks & Drivers (configuración, wiring) se cubren en menor medida.

Umbral mínimo exigido: **80% de líneas y ramas en Entities y Use Cases**, tanto en Backend como en Frontend. Se configura como `coverage.thresholds` en la configuración de Vitest de cada proyecto al scaffoldearlo (Documento 13), de forma que el propio comando `pnpm run test` falle si la cobertura cae por debajo del umbral — no es un objetivo aspiracional sin verificación, sino una condición para que el CI (Documento 13) pase en un Pull Request. Frameworks & Drivers no tiene umbral mínimo forzado, dado su menor valor de negocio por línea cubierta.

## Stack de testing

EWControl usa **Vitest** como runner de tests unitarios y de componentes tanto en Backend como en Frontend, en vez de Jest en el Backend y Jasmine/Karma en el Frontend. Se descarta Jest en el Backend —pese a ser la opción más "oficial" y documentada para NestJS— porque Vitest es API-compatible con Jest (mismo `describe`/`it`/`expect`) y permite mantener un único runner y una única configuración mental de testing en todo el stack. Se descarta Jasmine/Karma en el Frontend porque es el stack histórico de Angular CLI, ya en proceso de sustitución oficial por Vitest en el propio framework.

En el Frontend, Vitest se combina con **Testing Library** (`@testing-library/angular`), que obliga a testear componentes consultándolos por rol/texto accesible en vez de por detalles de implementación — reforzando la accesibilidad como efecto colateral (Documento 12, apartado 12.7).

Para tests end-to-end, en ambos lados se usa **Playwright**. Se descarta Cypress porque, aunque tiene más plugins y comunidad, Playwright ofrece multi-browser y multi-tab de forma nativa, mejor paralelización, y no tiene las restricciones de iframes de Cypress.

El detalle de convenciones de Frontend (SCSS, naming, componentes reutilizables) está en [12-convenciones-frontend.md](12-convenciones-frontend.md).

## Enforcement automático de convenciones

Las convenciones de naming (camelCase en TS/SCSS, Documento 12; snake_case solo en base de datos, Documento 4) no dependen únicamente de la disciplina manual: se verifican automáticamente antes de cada commit.

- **ESLint** (`backend/eslint.config.js`, `frontend/eslint.config.js`): regla `@typescript-eslint/naming-convention` en camelCase para variables/propiedades y PascalCase para tipos, en ambos proyectos. En el Frontend incluye además el ruleset de accesibilidad de `angular-eslint` sobre los templates (`templateAccessibility`), como primera verificación automática del checklist WCAG del Documento 12.
- **Stylelint** (`frontend/.stylelintrc.json`): exige `$variables` SCSS en camelCase y clases/Custom Properties CSS en kebab-case (Documento 12, apartados 12.1 y 12.3).
- **Prettier** (`.prettierrc.json`, raíz del repositorio): formato compartido entre Backend y Frontend.
- **Husky + lint-staged** (`.husky/pre-commit`, `package.json` de la raíz): ejecutan ESLint/Stylelint/Prettier sobre los archivos en stage antes de permitir el commit; un archivo que incumple una convención no se puede commitear.

Estas herramientas verifican forma (naming, formato, accesibilidad básica de templates), no sustituyen a TDD: los criterios de aceptación funcionales de una spec siguen verificándose con tests, no con linters.

---

# OWASP Top 10

La seguridad se trata como un requisito transversal, no como una fase aparte.

Cada feature vertical revisa, en su spec, si introduce superficie de ataque relevante para alguno de los 10 riesgos de OWASP.

La checklist detallada, con la mitigación concreta aplicada en EWControl para cada riesgo, vive en [06-seguridad-global.md](06-seguridad-global.md), sección "Checklist OWASP Top 10".

---

# Resumen

| Práctica                | Responde a                                                     |
| ----------------------- | -------------------------------------------------------------- |
| Spec-Driven Development | Qué construir y cómo se sabe que está bien construido          |
| Clean Architecture      | Cómo se organiza el código para que sea mantenible y testeable |
| Docs as Code            | Cómo evitar que la documentación se desactualice               |
| TDD                     | Cómo se verifica que el código cumple la spec                  |
| OWASP Top 10            | Cómo evitar introducir vulnerabilidades conocidas              |
