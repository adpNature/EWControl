# EWControl

## a. Descripción general del proyecto

EWControl es una plataforma web multiempresa para la monitorización industrial de maquinaria (bobinadoras de energía / Energy Winders) mediante comunicación OPC UA.

Permite a cada cliente visualizar el estado de sus máquinas, consultar históricos, gestionar alarmas y configurar dinámicamente qué señales monitorizar, desde una única aplicación.

El proyecto está en fase inicial: se está construyendo primero la fundación de backend (Simulador de datos demo + API REST) y, a partir de ahí, cada funcionalidad se desarrolla como una **feature vertical** que incluye backend y frontend juntos. La conexión a máquinas reales vía OPC UA llega en una fase posterior, sustituyendo al Simulador sin modificar el resto del sistema (ver [docs/01-vision.md](docs/01-vision.md) y [docs/10-simulador-datos-demo.md](docs/10-simulador-datos-demo.md)).

El estado actual del proyecto, fase a fase, está en la sección [Roadmap](#roadmap) más abajo.

---

## b. Stack tecnológico

| Área                                  | Tecnología                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------- |
| Frontend                              | Angular 21                                                                    |
| Backend                               | NestJS                                                                        |
| Base de datos de configuración        | PostgreSQL                                                                    |
| ORM / migraciones                     | TypeORM                                                                       |
| Base de datos de históricos           | InfluxDB                                                                      |
| Comunicación industrial (fase futura) | OPC UA                                                                        |
| Autenticación                         | JWT (access + refresh token) + bcrypt                                         |
| Logging (Backend)                     | Pino                                                                          |
| Iconografía (Frontend)                | Iconsax (versión gratuita)                                                    |
| Tipografía (Frontend)                 | Fira Sans                                                                     |
| Testing (unificado Back/Front)        | Vitest + Testing Library, Playwright (e2e)                                    |
| Calidad de código                     | ESLint + Stylelint + Prettier, forzados con Husky + lint-staged en pre-commit |
| Gestor de paquetes                    | pnpm                                                                          |
| Contenedores                          | Docker / Docker Compose                                                       |

Motivo de cada elección técnica (frente a las alternativas descartadas) en [docs/00-metodologia-y-calidad.md](docs/00-metodologia-y-calidad.md), [docs/04-persistencia-de-datos.md](docs/04-persistencia-de-datos.md), [docs/06-seguridad-global.md](docs/06-seguridad-global.md) y [docs/07-observabilidad-monitorizacion.md](docs/07-observabilidad-monitorizacion.md).

Metodología de desarrollo (Spec-Driven Development, Clean Architecture, Docs as Code, TDD, OWASP Top 10): ver [docs/00-metodologia-y-calidad.md](docs/00-metodologia-y-calidad.md).

---

## c. Instalación y ejecución

### Requisitos

- Docker y Docker Compose.
- Node.js 20+ y [pnpm](https://pnpm.io/) (solo si se ejecuta backend/frontend fuera de Docker durante el desarrollo).

### Variables de entorno

Cada proyecto (`/backend`, `/frontend`) incluye un `.env.example` con las variables necesarias. Como mínimo, el backend requiere:

```
# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=ewcontrol
POSTGRES_USER=ewcontrol
POSTGRES_PASSWORD=<definir en local, nunca commitear>

# InfluxDB
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=<definir en local, nunca commitear>
INFLUXDB_ORG=ewcontrol
INFLUXDB_BUCKET=signals

# Auth (Documento 6, apartado 6.2)
JWT_ACCESS_SECRET=<definir en local, nunca commitear>
JWT_REFRESH_SECRET=<definir en local, nunca commitear>
```

Ningún secreto se commitea al repositorio: `.env` está en `.gitignore`, solo `.env.example` se versiona.

### Levantar el entorno de desarrollo

```bash
docker compose up -d
```

Esto levanta PostgreSQL, InfluxDB, el backend (NestJS) y el frontend (Angular) definidos en `docker-compose.yml` (ver [docs/05-despliegue-infraestructura.md](docs/05-despliegue-infraestructura.md)).

> En Windows, los eventos de sistema de archivos no siempre llegan al contenedor a través del bind mount (depende de la ruta y del backend de Docker Desktop), así que el hot-reload por defecto puede no dispararse. Por eso `backend/tsconfig.json` fuerza `watchOptions` por polling y `frontend/angular.json` fija `poll: 1000` en la configuración `development` de `serve`. No son configuraciones redundantes: quítalas y el hot-reload puede dejar de funcionar en Windows.

### Poblar datos demo

Al levantar el entorno por primera vez, un script de seed crea:

- Una Company y un usuario de prueba (ver sección f).
- Una Machine demo tipo bobinadora, en modo `Simulator` (Documento 10).
- 7 días de histórico pre-poblado para esa Machine.

```bash
docker compose exec backend pnpm run seed
```

### Ejecutar tests

```bash
docker compose exec backend pnpm run test
docker compose exec frontend pnpm run test
```

El proyecto sigue TDD (ver [docs/00-metodologia-y-calidad.md](docs/00-metodologia-y-calidad.md)): ningún caso de uso se da por terminado sin sus tests correspondientes a los criterios de aceptación de su spec.

---

## d. Estructura del proyecto

```
/backend    Proyecto NestJS (API REST + WebSocket).
/frontend   Proyecto Angular.
/docs       Documentación técnica y de producto (este directorio).
/docs/specs Specs de cada feature (Spec-Driven Development).
/docker     Definiciones de contenedores (Dockerfiles).
/scripts    Scripts de despliegue y utilidades (ej. seed de datos demo).
```

La información de despliegue (contenedores, orquestación, entornos) vive dentro de `/docs`, en [docs/05-despliegue-infraestructura.md](docs/05-despliegue-infraestructura.md).

---

## e. Funcionalidades principales

- **Autenticación multiempresa**: login con JWT, aislamiento estricto de datos por Company (Documento 6).
- **Configuración dinámica de máquinas y señales**: sin desarrollos específicos por modelo de máquina (Documento 3).
- **Datos demo mediante Simulador**: generación realista de lecturas sin necesidad de hardware, con posibilidad de forzar fallos para probar alarmas y reconexión (Documento 10).
- **Dashboard dinámico y en tiempo real**: construido a partir de la configuración del usuario, actualizado por WebSocket (Documento 8).
- **Históricos optimizados**: consulta de series temporales con resolución adaptada al rango solicitado (Documento 4).
- **Gestión de alarmas**: reglas configurables por señal, con notificación y trazabilidad (Documento 2, apartado 2.6).
- **Preparada para OPC UA real**: el mismo modelo de dominio soporta sustituir el Simulador por un servidor OPC UA sin modificar el resto de la plataforma (Documento 1, Documento 10).

---

## f. Usuario y contraseña de prueba

El script de seed (sección c) crea el siguiente usuario de demo, con rol `AdminCliente`:

```
Email:      demo@ewcontrol.local
Contraseña: Demo1234!
```

Válido tanto para el login del Frontend como para obtener un token directamente contra `POST /api/v1/auth/login` (Documento 11). Detalle completo del flujo en [docs/specs/auth-login.md](docs/specs/auth-login.md).

---

## Principios de diseño

- **Desacoplamiento**: la aplicación nunca depende directamente del protocolo de comunicación; el backend solo conoce un Data Provider (Documento 2).
- **Configuración dinámica**: las máquinas no están programadas dentro de la aplicación.
- **Escalabilidad progresiva**: la arquitectura crece sin rediseñarse, evitando sobreingeniería (Documento 2, "Evolución Controlada").
- **Separación de responsabilidades**: cada servicio tiene una única responsabilidad (Auth, Alarmas, Históricos, Comunicación industrial, Dashboard, Notificaciones).
- **Clean Architecture y Spec-Driven Development**: ninguna funcionalidad se programa sin spec previa; el código se organiza en capas con dependencias apuntando siempre hacia el dominio (Documento 0).

---

## Arquitectura general

```
                 Angular
                    │
            API REST / WebSocket
                    │
               NestJS Backend
                    │
     ┌───────────┬──────────┬───────────┐
     │           │          │           │
   Auth    Data Provider  Alarm Engine  ...
     │           │          │           │
     └───────────┴──────────┴───────────┘
             Realtime Cache
                    │
         ┌──────────┴──────────┐
         │                     │
    PostgreSQL             InfluxDB
```

Detalle completo de capas, componentes y flujo de datos en [docs/02-arquitectura.md](docs/02-arquitectura.md).

---

## Índice de Documentación

| Documento                                                                       | Contenido                                                                                                                                    |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [00-metodologia-y-calidad.md](docs/00-metodologia-y-calidad.md)                 | Spec-Driven Development, Clean Architecture, Docs as Code, TDD, OWASP Top 10                                                                 |
| [01-vision.md](docs/01-vision.md)                                               | Visión del producto, público objetivo, roles y alcance inicial                                                                               |
| [02-arquitectura.md](docs/02-arquitectura.md)                                   | Arquitectura en capas, Data Providers, Signal Engine, Realtime Cache, eventos, Alarm Engine, History Service, Notification Service, Adapters |
| [03-modelo-de-datos.md](docs/03-modelo-de-datos.md)                             | Modelo del dominio: entidades, relaciones, Value Objects y enumeraciones                                                                     |
| [04-persistencia-de-datos.md](docs/04-persistencia-de-datos.md)                 | PostgreSQL, InfluxDB y su relación con el resto de componentes                                                                               |
| [05-despliegue-infraestructura.md](docs/05-despliegue-infraestructura.md)       | Contenedores, orquestación, despliegue en el edge, escalado, alta disponibilidad y backups                                                   |
| [06-seguridad-global.md](docs/06-seguridad-global.md)                           | Autenticación JWT, certificados, segmentación OT/IT, cifrado, auditoría y checklist OWASP Top 10                                             |
| [07-observabilidad-monitorizacion.md](docs/07-observabilidad-monitorizacion.md) | Logs, métricas, alerting de infraestructura, health checks y trazabilidad                                                                    |
| [08-frontend-dashboard.md](docs/08-frontend-dashboard.md)                       | Arquitectura del Frontend, Dashboard dinámico, tiempo real y configuración                                                                   |
| [09-conclusion-vision-global.md](docs/09-conclusion-vision-global.md)           | Visión global, flujo end-to-end, principios transversales y evolución futura                                                                 |
| [10-simulador-datos-demo.md](docs/10-simulador-datos-demo.md)                   | Algoritmo de generación, seeds por tipo de máquina, fallos controlables, transición a OPC UA                                                 |
| [11-api-rest.md](docs/11-api-rest.md)                                           | Catálogo de endpoints REST, convenciones, contrato WebSocket                                                                                 |
| [12-convenciones-frontend.md](docs/12-convenciones-frontend.md)                 | Naming, arquitectura SCSS, componentes reutilizables, responsive y accesibilidad                                                             |
| [13-cicd-devops.md](docs/13-cicd-devops.md)                                     | Ramas, commits, pipeline de CI, protección de `main`, versionado automático                                                                  |
| [specs/](docs/specs/)                                                           | Spec de cada feature (Spec-Driven Development), una por funcionalidad                                                                        |

---

## Roadmap

| Fase   | Contenido                                                         | Estado                                 |
| ------ | ----------------------------------------------------------------- | -------------------------------------- |
| Fase 0 | Metodología y documentación base                                  | Completada                             |
| Fase 1 | Fundación backend: Simulador de datos demo + catálogo de API REST | En curso                               |
| Fase 2 | Feature vertical: Autenticación (Auth)                            | Especificada, pendiente de implementar |
| Fase 3 | Feature vertical: Gestión de Machines y Signals                   | Pendiente                              |
| Fase 4 | Feature vertical: Dashboard en tiempo real                        | Pendiente                              |
| Fase 5 | Feature vertical: Históricos y Alarmas                            | Pendiente                              |
| Fase 6 | Integración OPC UA real                                           | Pendiente                              |

Cada fase a partir de la 2 se especifica en `docs/specs/` antes de implementarse (Documento 0).

---

## Licencia

Este proyecto es de código visible PolyForm Noncommercial License 1.0.0. Eres libre de usar, estudiar, modificar y contribuir al código con fines no comerciales.

El uso comercial requiere permiso explícito por escrito del autor.
