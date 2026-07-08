# 13. CI/CD y DevOps

## Introducción

`docs/05-despliegue-infraestructura.md` reserva explícitamente el pipeline de integración y entrega continua para "cuando el proyecto lo requiera". Este documento lo retoma: fija cómo se aplica la filosofía DevOps en EWControl desde ahora — integración continua, automatización de calidad y feedback rápido — dejando fuera, deliberadamente, el despliegue continuo a un entorno real hasta que exista uno (Documento 5, "Estado de este documento").

DevOps no es solo el pipeline: ya hay piezas de esta filosofía en el resto de la documentación —contenedores (Documento 5), observabilidad (Documento 7), TDD y automatización de convenciones vía Husky (Documento 0)—. Este documento añade la pieza que faltaba: cómo se integra y verifica el trabajo de todos automáticamente, no solo en cada máquina local.

---

## Plataforma: GitHub + GitHub Actions

Se descarta GitLab (todo-en-uno repo+CI+registry) porque no aporta ventaja concreta sobre GitHub para el tamaño actual del proyecto, mientras que GitHub Actions tiene mejor integración nativa con Pull Requests, un ecosistema de acciones ya hechas más amplio (`setup-node`, `docker/build-push-action`...) y es gratuito para el uso actual.

---

## Gestor de paquetes: pnpm

Se usa **pnpm** en la raíz, `/backend` y `/frontend` (cada uno con su propio `package.json` y `pnpm-lock.yaml`; no se usan workspaces de pnpm, siguen siendo tres instalaciones independientes, solo cambia la herramienta). Se descarta npm porque pnpm resuelve las dependencias de forma más estricta —evita que un paquete acceda a una dependencia transitiva no declarada explícitamente (_phantom dependency_)— y comparte un único almacén de paquetes por contenido entre proyectos, acelerando instalaciones y reduciendo espacio en disco. Se descarta Yarn por no aportar ventaja adicional frente a pnpm en este aspecto, con un ecosistema de plugins más fragmentado.

La versión de pnpm queda fijada en el campo `packageManager` de cada `package.json` (consumido automáticamente por Corepack en Docker y por `pnpm/action-setup` en CI), igual que `.nvmrc` fija la versión de Node.

### Scripts de instalación nativa

Por defecto, pnpm no ejecuta scripts `postinstall` que compilan binarios nativos, como medida de seguridad frente a ataques a la cadena de suministro. `bcrypt` y `@swc/core` (Backend) y `esbuild`, `@parcel/watcher`, `lmdb` y `msgpackr-extract` (Frontend, parte de la cadena de build de Angular) sí necesitan compilar su binding nativo para funcionar. Se permiten explícitamente mediante `pnpm.onlyBuiltDependencies` en cada `package.json`, en vez de aprobarlos de forma interactiva (`pnpm approve-builds`) o desactivar la protección globalmente.

### Incompatibilidad conocida y aceptada: Stylelint bajo la resolución por symlinks de pnpm

El cargador de plugins de Stylelint (`stylelint-scss`, usado por `stylelint-config-standard-scss`) falla al resolver una dependencia transitiva propia (`@csstools/css-syntax-patches-for-csstree`) bajo la estructura de `node_modules` por symlinks que usa pnpm por defecto — una incompatibilidad conocida entre pnpm y cargadores de módulos que no siguen el algoritmo de resolución estándar de Node. Se resuelve en `frontend/.npmrc` con `node-linker=hoisted`, que genera un `node_modules` plano (igual que npm/Yarn clásico) solo para el Frontend, conservando el resto de ventajas de pnpm (almacén compartido, instalación más rápida) excepto la resolución estricta de dependencias fantasma en ese proyecto concreto. El Backend no necesita este ajuste.

---

## Estrategia de Ramas: GitHub Flow

- `main` está siempre en estado desplegable.
- Cada feature vertical (Documento 0) se desarrolla en una rama corta (`feature/auth-login`, `feature/simulador-generar-lectura`...), idealmente una rama por spec.
- El trabajo se integra a `main` mediante Pull Request, nunca con push directo (ver protección de rama más abajo).

Se descarta Git Flow (`develop`/`release/*`/`hotfix/*`) por ser una estructura pensada para mantener varias versiones en producción simultáneamente, algo que no aplica a EWControl mientras no haya múltiples versiones desplegadas en paralelo (Documento 2, "Evolución Controlada").

---

## Convención de Commits: Conventional Commits

Todo commit sigue el formato `tipo(alcance opcional): descripción`, con tipos como `feat`, `fix`, `docs`, `chore`, `test`, `refactor`. Se verifica automáticamente con **commitlint**, enganchado al hook `commit-msg` de Husky (`commitlint.config.js`, `.husky/commit-msg`) — ya configurado junto al resto de hooks de calidad (Documento 0, "Enforcement automático de convenciones").

Esta convención no es solo estética: es lo que permite generar versión y changelog automáticos (ver "Versionado" más abajo) sin decidir a mano, en cada release, si un cambio es mayor, menor o un parche.

---

## Pipeline de CI

En esta fase (fundación backend + primeras features verticales, sin entorno de producción todavía) el pipeline de CI cubre exclusivamente **integración continua**: verificar que el código de cada Pull Request cumple las convenciones y pasa sus tests, no desplegar nada.

| Workflow                        | Disparador                         | Qué hace                                                                                                                                                         |
| ------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`      | Pull Request contra `main`         | Lint (ESLint + Stylelint) + tests unitarios/componente (Vitest) + build de Backend y Frontend.                                                                   |
| `.github/workflows/e2e.yml`     | Push a `main` (tras mergear un PR) | Tests end-to-end con Playwright contra la aplicación completa. Se ejecuta solo al mergear, no en cada PR, para no ralentizar la revisión con la suite más lenta. |
| `.github/workflows/release.yml` | Push a `main`                      | `semantic-release`: analiza los commits desde el último release y publica versión + `CHANGELOG.md` si corresponde.                                               |

### Scripts que cada proyecto debe exponer

Para que estos workflows funcionen, `backend/package.json` y `frontend/package.json` deben definir, con esos nombres exactos, los scripts que invoca el pipeline:

| Script      | Backend                   | Frontend                 |
| ----------- | ------------------------- | ------------------------ |
| `lint`      | ESLint                    | ESLint                   |
| `stylelint` | —                         | Stylelint sobre `*.scss` |
| `test`      | Vitest (unit/component)   | Vitest + Testing Library |
| `test:e2e`  | — (o Supertest si aplica) | Playwright               |
| `build`     | Build de NestJS           | Build de Angular         |

### Estado actual

El scaffolding real de `/backend` y `/frontend` (Documento 0, Fase 1) ya existe, con los scripts exactos que esperan los tres workflows: el pipeline está activo desde el primer Pull Request. El Frontend ya tiene sus primeros tests (`app.spec.ts`); el Backend, al no tener todavía lógica de negocio propia (solo wiring de Frameworks & Drivers), no tiene specs propias — `backend/vitest.config.ts` fija `passWithNoTests: true` para que esa ausencia temporal no tumbe el CI. En cuanto la primera feature vertical (`docs/specs/05-auth-login.md`) añada código en Entities/Use Cases, sus tests dejan de ser opcionales y el umbral del 80% de cobertura (Documento 0, "Cobertura") empieza a aplicarse de verdad.

---

## Protección de la rama `main`

`main` exige que el workflow `ci.yml` termine en verde antes de permitir el merge de un Pull Request. No se exige una aprobación de otra persona todavía, al ser un equipo reducido — se revisará esta regla si el equipo crece, añadiendo entonces revisión obligatoria.

---

## Versionado: semantic-release

Cada push a `main` ejecuta `semantic-release` (`.releaserc.json`), que analiza los Conventional Commits desde el último release para decidir automáticamente el siguiente número de versión:

| Tipo de commit                                          | Efecto en la versión                             |
| ------------------------------------------------------- | ------------------------------------------------ |
| `fix:`                                                  | Incrementa versión de parche (`1.0.0` → `1.0.1`) |
| `feat:`                                                 | Incrementa versión menor (`1.0.0` → `1.1.0`)     |
| Cualquier commit con `BREAKING CHANGE:` en el cuerpo    | Incrementa versión mayor (`1.0.0` → `2.0.0`)     |
| `docs:`, `chore:`, `test:`, `refactor:` sin lo anterior | No genera nueva versión                          |

`semantic-release` genera además `CHANGELOG.md` automáticamente y crea el release en GitHub, evitando decidir manualmente el número de versión o redactar el changelog a mano en cada entrega.

### Riesgo conocido y aceptado: copia de `npm` embebida en `@semantic-release/npm`

`semantic-release` depende de `@semantic-release/npm` (el plugin que publicaría a un registro npm), que a su vez empaqueta una copia completa del propio CLI de `npm` como dependencia **bundled**, con sus propias vulnerabilidades transitivas (`tar`, `picomatch`, `sigstore`...). `pnpm audit` en la raíz no señala actualmente ninguna vulnerabilidad para esta cadena (a diferencia de `npm audit`, que sí las reportaba antes de migrar a pnpm — Documento 0), pero la causa de fondo —esa copia de `npm` embebida— sigue presente en el árbol de dependencias independientemente de lo que reporte la herramienta de auditoría del momento.

Se acepta este riesgo conscientemente porque `@semantic-release/npm` **no está en la lista de `plugins` de `.releaserc.json`**: su código de publicación (y por tanto toda esta cadena de dependencias) nunca se ejecuta en `release.yml`, solo se instala como dependencia inerte. Si `pnpm audit` o Dependabot (`.github/dependabot.yml`) empiezan a señalar esta cadena, no se fuerza un downgrade de `semantic-release` para "resolverlo", porque eso sería cambiar una versión estable por una vulnerabilidad real a cambio de silenciar una inerte.

---

## Mantenimiento automatizado y consistencia de PRs

- **Dependabot** (`.github/dependabot.yml`): abre Pull Requests semanales de actualización de dependencias para la raíz, `/backend`, `/frontend` y las propias GitHub Actions usadas en los workflows — cierra en la práctica el compromiso de "dependencias actualizadas" del checklist OWASP (Documento 6, A06), en vez de depender de una revisión manual periódica.
- **Plantilla de Pull Request** (`.github/PULL_REQUEST_TEMPLATE.md`): obliga a enlazar la spec que implementa el PR y a repasar un checklist mínimo (tests por criterio de aceptación, lint limpio, accesibilidad si toca UI, documentación actualizada en el mismo PR) — lleva a la práctica, en cada PR, la disciplina de Spec-Driven Development y Docs as Code del Documento 0.
- **Versión de Node fijada** (`.nvmrc`, raíz): evita divergencias entre la versión de Node usada en local y la fijada en los workflows de CI (Node 20).

---

## Qué queda fuera, deliberadamente

- **Despliegue continuo (CD) a un entorno real**: no existe todavía un entorno de desarrollo/staging accesible al que desplegar (Documento 5, secciones marcadas como diseño de referencia diferido). Cuando exista, este documento se amplía con el workflow de despliegue correspondiente.
- **Publicación de imágenes Docker a un registry**: se pospone por el mismo motivo; se documentará junto con el primer entorno real.
- **Infraestructura como código** (Terraform/Pulumi u otro): no aplica todavía porque no hay infraestructura de nube que provisionar; el único "entorno" actual es Docker Compose en local (Documento 5).

---

## Decisión Arquitectónica

EWControl aplica DevOps de forma incremental, igual que el resto de la arquitectura (Documento 2, "Evolución Controlada"): integración continua y automatización de calidad desde el primer commit, y entrega continua solo cuando exista un entorno real que la justifique. Esto evita construir un pipeline de despliegue para un destino que todavía no existe, sin renunciar a la disciplina de verificar automáticamente cada cambio antes de integrarlo.
