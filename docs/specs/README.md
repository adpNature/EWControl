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

| Spec                                                               | Feature                                                             | Backend | Frontend       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | ------- | -------------- |
| [01-fundacion-entorno-demo.md](01-fundacion-entorno-demo.md)       | Creación de Company/User/Machine/Signals demo (seed)                | Sí      | No (fundación) |
| [02-simulador-generar-lectura.md](02-simulador-generar-lectura.md) | Generación periódica de lecturas simuladas                          | Sí      | No (fundación) |
| [03-simulador-forzar-fallo.md](03-simulador-forzar-fallo.md)       | Forzar desconexión/calidad degradada en una máquina demo            | Sí      | No (fundación) |
| [04-simulador-seed-historico.md](04-simulador-seed-historico.md)   | Pre-poblado de histórico al provisionar una máquina demo            | Sí      | No (fundación) |
| [05-auth-login.md](05-auth-login.md)                               | Autenticación de usuario (login)                                    | Sí      | Sí             |
| [06-gestion-machines-signals.md](06-gestion-machines-signals.md)   | Gestión de Machines y Signals (CRUD)                                | Sí      | Sí             |
| [07-dashboard-tiempo-real.md](07-dashboard-tiempo-real.md)         | Dashboard en tiempo real (Signal Engine, Realtime Cache, WebSocket) | Sí      | Sí             |
