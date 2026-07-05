# 13. CI/CD y DevOps

## Introducción

`docs/05-despliegue-infraestructura.md` reserva explícitamente el pipeline de integración y entrega continua para "cuando el proyecto lo requiera". Este documento lo retoma: fija cómo se aplica la filosofía DevOps en EWControl desde ahora — integración continua, automatización de calidad y feedback rápido — dejando fuera, deliberadamente, el despliegue continuo a un entorno real hasta que exista uno (Documento 5, "Estado de este documento").

DevOps no es solo el pipeline: ya hay piezas de esta filosofía en el resto de la documentación —contenedores (Documento 5), observabilidad (Documento 7), TDD y automatización de convenciones vía Husky (Documento 0)—. Este documento añade la pieza que faltaba: cómo se integra y verifica el trabajo de todos automáticamente, no solo en cada máquina local.

---

## Plataforma: GitHub + GitHub Actions

Se descarta GitLab (todo-en-uno repo+CI+registry) porque no aporta ventaja concreta sobre GitHub para el tamaño actual del proyecto, mientras que GitHub Actions tiene mejor integración nativa con Pull Requests, un ecosistema de acciones ya hechas más amplio (`setup-node`, `docker/build-push-action`...) y es gratuito para el uso actual.

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

| Workflow | Disparador | Qué hace |
|---|---|---|
| `.github/workflows/ci.yml` | Pull Request contra `main` | Lint (ESLint + Stylelint) + tests unitarios/componente (Vitest) + build de Backend y Frontend. |
| `.github/workflows/e2e.yml` | Push a `main` (tras mergear un PR) | Tests end-to-end con Playwright contra la aplicación completa. Se ejecuta solo al mergear, no en cada PR, para no ralentizar la revisión con la suite más lenta. |
| `.github/workflows/release.yml` | Push a `main` | `semantic-release`: analiza los commits desde el último release y publica versión + `CHANGELOG.md` si corresponde. |

### Scripts que cada proyecto debe exponer

Para que estos workflows funcionen, `backend/package.json` y `frontend/package.json` deben definir, con esos nombres exactos, los scripts que invoca el pipeline:

| Script | Backend | Frontend |
|---|---|---|
| `lint` | ESLint | ESLint |
| `stylelint` | — | Stylelint sobre `*.scss` |
| `test` | Vitest (unit/component) | Vitest + Testing Library |
| `test:e2e` | — (o Supertest si aplica) | Playwright |
| `build` | Build de NestJS | Build de Angular |

### Estado actual

Los tres workflows y las configuraciones de ESLint/Stylelint (Documento 0, Documento 12) ya están escritos y listos, **antes** de que exista el scaffolding real de `/backend` y `/frontend` (Documento 0, Fase 1). Esto es intencional, igual que el resto de configuración "en espera" de esta fase: hasta que no exista un `package.json` real en cada proyecto con esos scripts, el pipeline fallará al no encontrar nada que ejecutar. Se activa solo con crear los proyectos y sus scripts, sin tocar los workflows.

---

## Protección de la rama `main`

`main` exige que el workflow `ci.yml` termine en verde antes de permitir el merge de un Pull Request. No se exige una aprobación de otra persona todavía, al ser un equipo reducido — se revisará esta regla si el equipo crece, añadiendo entonces revisión obligatoria.

---

## Versionado: semantic-release

Cada push a `main` ejecuta `semantic-release` (`.releaserc.json`), que analiza los Conventional Commits desde el último release para decidir automáticamente el siguiente número de versión:

| Tipo de commit | Efecto en la versión |
|---|---|
| `fix:` | Incrementa versión de parche (`1.0.0` → `1.0.1`) |
| `feat:` | Incrementa versión menor (`1.0.0` → `1.1.0`) |
| Cualquier commit con `BREAKING CHANGE:` en el cuerpo | Incrementa versión mayor (`1.0.0` → `2.0.0`) |
| `docs:`, `chore:`, `test:`, `refactor:` sin lo anterior | No genera nueva versión |

`semantic-release` genera además `CHANGELOG.md` automáticamente y crea el release en GitHub, evitando decidir manualmente el número de versión o redactar el changelog a mano en cada entrega.

---

## Qué queda fuera, deliberadamente

- **Despliegue continuo (CD) a un entorno real**: no existe todavía un entorno de desarrollo/staging accesible al que desplegar (Documento 5, secciones marcadas como diseño de referencia diferido). Cuando exista, este documento se amplía con el workflow de despliegue correspondiente.
- **Publicación de imágenes Docker a un registry**: se pospone por el mismo motivo; se documentará junto con el primer entorno real.
- **Infraestructura como código** (Terraform/Pulumi u otro): no aplica todavía porque no hay infraestructura de nube que provisionar; el único "entorno" actual es Docker Compose en local (Documento 5).

---

## Decisión Arquitectónica

EWControl aplica DevOps de forma incremental, igual que el resto de la arquitectura (Documento 2, "Evolución Controlada"): integración continua y automatización de calidad desde el primer commit, y entrega continua solo cuando exista un entorno real que la justifique. Esto evita construir un pipeline de despliegue para un destino que todavía no existe, sin renunciar a la disciplina de verificar automáticamente cada cambio antes de integrarlo.
