# Specs

Esta carpeta contiene las specs de EWControl: la especificación de cada funcionalidad antes de programarla.

El proceso que siguen y su relación con Clean Architecture, TDD y Docs as Code está descrito en [00-metodologia-y-calidad.md](../00-metodologia-y-calidad.md).

## Nomenclatura

Cada spec se nombra `NN-nombre-de-la-feature.md`, con `NN` correlativo según el orden de creación (`01`, `02`...). El número fija el orden del Índice y de implementación; no se reutilizan números de specs eliminadas ni se renumeran las existentes al añadir una nueva.

## Plantilla

```markdown
# Spec: <nombre de la feature>

## Contexto

Qué documento de arquitectura/modelo respalda esta spec, y por qué existe esta funcionalidad.

## Actor(es)

Quién la ejecuta (rol, servicio, o "Sistema" si es automática).

## Precondiciones

Qué debe cumplirse antes de que el flujo pueda empezar.

## Backend

### Flujo principal (Given/When/Then)

### Casos borde / errores (Given/When/Then)

### Contrato de entrada/salida

Referencia al endpoint/evento correspondiente en [11-api-rest.md](../11-api-rest.md) si aplica.

### Criterios de aceptación backend

Lista verificable, base de los tests TDD.

## Frontend

### Flujo principal (Given/When/Then, interacción de usuario)

### Casos borde / errores de UI

### Componentes/pantallas involucrados

Referencia a [08-frontend-dashboard.md](../08-frontend-dashboard.md) si aplica.

### Criterios de aceptación frontend

Lista verificable, base de los tests TDD.
```

Si una spec no tiene parte de frontend (por ejemplo, funcionalidad de fundación sin interfaz propia, como el Simulador), se omite la sección Frontend y se indica explícitamente al principio del documento.

## Índice

| Spec                                                               | Feature                                                                         | Backend | Frontend       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------- | -------------- |
| [01-fundacion-entorno-demo.md](01-fundacion-entorno-demo.md)       | Creación de Company/User/Machine/Signals demo (seed)                            | Sí      | No (fundación) |
| [02-simulador-generar-lectura.md](02-simulador-generar-lectura.md) | Generación periódica de lecturas simuladas                                      | Sí      | No (fundación) |
| [03-simulador-forzar-fallo.md](03-simulador-forzar-fallo.md)       | Forzar desconexión/calidad degradada en una máquina demo                        | Sí      | No (fundación) |
| [04-simulador-seed-historico.md](04-simulador-seed-historico.md)   | Pre-poblado de histórico al provisionar una máquina demo                        | Sí      | No (fundación) |
| [05-auth-login.md](05-auth-login.md)                               | Autenticación de usuario (login)                                                | Sí      | Sí             |
| [06-gestion-machines-signals.md](06-gestion-machines-signals.md)   | Gestión de Machines y Signals (CRUD)                                            | Sí      | Sí             |
| [07-dashboard-tiempo-real.md](07-dashboard-tiempo-real.md)         | Dashboard en tiempo real (Signal Engine, Realtime Cache, WebSocket)             | Sí      | Sí             |
| [08-historicos.md](08-historicos.md)                               | Históricos (persistencia continua a InfluxDB, consulta por rango, widget CHART) | Sí      | Sí             |

## Pendientes

Specs identificadas pero aún no redactadas — numeración tentativa, correlativa a partir de `08`. El orden sigue el Roadmap del [README](../../README.md#roadmap); la Fase 11 (OPC UA) siempre queda última.

| Nº tentativo | Feature                                                                        | Fase (Roadmap) | Backend | Frontend | Notas                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------ | -------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 09           | Alarmas (`AlarmDefinition`/`AlarmState`, Alarm Engine, notificación web+email) | Fase 5         | Sí      | Sí       | Cierra la Fase 5; Históricos (spec 08) ya está completado dentro de esa misma fase.                                                                                                 |
| 10           | Gestión de Companies y Users (SuperAdmin)                                      | Fase 6         | Sí      | Sí       | Incluye alta de Companies y CRUD de Users; incluye cambio/recuperación de contraseña self-service (`docs/03-modelo-de-datos.md` §3.2.2), sin endpoint hoy en `docs/11-api-rest.md`. |
| 11           | Reconocimiento manual de alarmas (ACK)                                         | Fase 7         | Sí      | Sí       | Evolución de `AlarmState` (`docs/03-modelo-de-datos.md` §3.2.7); `docs/11-api-rest.md:186` la deja fuera del catálogo hasta que exista esta spec. Depende de la spec 09.            |
| 12           | Motor de fórmulas del Signal Engine (Signals `FORMULA`)                        | Fase 8         | Sí      | No       | Diferido explícitamente en `07-dashboard-tiempo-real.md:11` y `08-historicos.md:22`; sin esto, `FORMULA` no tiene valor en tiempo real, histórico ni alarma.                        |
| 13           | Históricos — pantalla independiente y comparativas multi-Signal/Machine        | Fase 9         | Sí      | Sí       | Diferido explícitamente en `08-historicos.md:21`; distinto del widget `CHART` ya implementado.                                                                                      |
| 14           | Observabilidad técnica (health checks, métricas, alerting de infraestructura)  | Fase 10        | Sí      | No       | Puramente backend/infra (`docs/07-observabilidad-monitorizacion.md`); no sigue el patrón de feature vertical Back+Front, evaluar si necesita el mismo formato de spec.              |
