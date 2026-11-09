# Presentación TFM — EWControl

> Documento pensado para exportar a Google Slides / PowerPoint. Cada `##` es una diapositiva.
> Incluye dos bloques: una versión **no técnica** (resumen ejecutivo, para público general) y la versión **técnica** completa (para el tribunal).

---

# Parte 1 — Versión no técnica

## Slide 1: EWControl

- Una forma sencilla de tener tus máquinas bajo control.
- Hoy, saber cómo va tu maquinaria significa estar delante de ella, o depender de que alguien te llame cuando algo ya ha fallado.
- EWControl es la ventana que te faltaba para ver qué hacen tus máquinas sin liarte: abres el móvil o el ordenador y ya sabes cómo va todo, así de simple.
- **"No venimos a sustituir un centro de control industrial. Venimos a darte justo lo que necesitas, sin más."**

---

## Slide 2: Qué hace por ti

- **Todo a la vista, en directo y en el tiempo**: cómo están tus máquinas ahora y cómo se han comportado en el pasado, en la misma pantalla.
- **Te avisamos antes de que sea un problema**: en cuanto algo se sale de lo normal, un aviso en la web y por email, con quién y cuándo lo revisó.
- **Se adapta a ti, sin programar nada**: añade máquinas, señales y paneles desde la propia plataforma.
- **Tu empresa, tu propio espacio**: cada cliente ve únicamente sus máquinas y sus datos.

---

## Slide 3: Un día cualquiera con EWControl

- Entras y ves tus máquinas, en directo.
- Una señal se sale de rango → te llega un aviso.
- Miras el histórico para entender qué ha pasado.
- Confirmas el aviso, y queda registro de quién y cuándo.

---

# Parte 2 — Versión técnica

## Slide 4: Contexto y problema

- Las plantas industriales necesitan visibilidad remota de sus máquinas: estado en vivo, histórico, alarmas.
- Un SCADA completo es caro, pesado y normalmente on-premise: sobra para quien solo necesita supervisar, no controlar el proceso.
- Cada fabricante/integrador que quiere ofrecer esto a sus clientes acaba desarrollando una solución a medida por cliente.
- **Hueco de mercado**: falta una plataforma ligera, remota y multi-cliente que no reinvente un SCADA.

---

## Slide 5: Objetivos del proyecto

- **Objetivo general**: diseñar y construir una plataforma web multi-tenant de supervisión de maquinaria industrial ("Energy Winders") sobre el protocolo OPC UA.
- **Objetivos específicos**:
  - Aislar completamente los datos de cada empresa cliente (multi-tenancy real).
  - Permitir configurar máquinas, señales, dashboards y alarmas sin escribir código nuevo.
  - Ofrecer visualización en tiempo real e histórico optimizado.
  - Aplicar un proceso de ingeniería riguroso (spec-driven, TDD, seguridad por diseño) desde la base.
  - Dejar preparada la integración con hardware OPC UA real sin rediseñar el sistema.

---

## Slide 6: ¿Qué es EWControl?

- Plataforma **SaaS multi-tenant** para supervisar maquinaria industrial ("Energy Winders") vía OPC UA.
- Da a operarios, mantenimiento y dirección una ventana remota y moderna a los datos de máquina, desde cualquier dispositivo.
- Cada empresa cliente ve únicamente sus propias máquinas y datos.

---

## Slide 7: Arquitectura general

- Basada en **Clean Architecture**, por capas, dependencias siempre hacia adentro:
  - **Entities** — dominio puro (Company, User, Machine, Signal, AlarmDefinition, Dashboard…).
  - **Use Cases** — lógica de aplicación (auth, históricos, notificaciones, scheduler).
  - **Interface Adapters** — proveedores de datos, persistencia (Postgres/InfluxDB), REST, WebSocket.
  - **Frameworks & Drivers** — Nest, config, logging; única capa que conoce a todas las demás.
- Regla dura: el dashboard nunca habla directo con el PLC, solo con la caché en tiempo real.

---

## Slide 8: Stack tecnológico

- **Frontend**: Angular
- **Backend**: NestJS
- **Datos de configuración**: PostgreSQL + TypeORM
- **Series temporales**: InfluxDB
- **Autenticación**: JWT (access + refresh) + bcrypt
- **Observabilidad**: Pino (logging estructurado)
- **Entorno**: Docker Compose, pnpm

---

## Slide 9: Multi-tenancy y seguridad

- **Company** es el perímetro de seguridad: el aislamiento entre clientes se aplica en cada capa (aplicación, base de datos, series temporales).
- Autenticación JWT de corta duración + refresh token rotado.
- Cifrado en tránsito y en reposo; segregación de red OT/IT prevista para el borde industrial.
- Cada spec se revisa contra el checklist OWASP Top 10 antes de darse por cerrada.
- Auditoría/trazabilidad de acciones relevantes.

---

## Slide 10: Metodología — Spec-Driven Development + TDD

- **Ninguna funcionalidad se codifica sin spec previa**, revisada antes de tocar código.
- Cada spec es **vertical**: backend + frontend en una sola entrega, no features a medias.
- Ciclo TDD: tests desde los criterios de aceptación (red) → implementación mínima (green) → refactor.
- Cobertura mínima obligatoria: **80% líneas/ramas** en Entities y Use Cases.
- Lint, tests y checklist de seguridad se ejecutan en cada Pull Request.

---

## Slide 11: Funcionalidades entregadas

- Simulador de datos + catálogo REST (base del sistema).
- Autenticación y gestión de sesión.
- Alta y gestión de máquinas y señales.
- Dashboard en tiempo real (WebSocket).
- Histórico de señales + motor de alarmas configurable.
- Administración de compañías y usuarios (rol SuperAdmin).
- Confirmación (ACK) de alarmas con trazabilidad.
- Navegación y shell de la aplicación.
- Motor de fórmulas para señales calculadas.
- Comparativas históricas.
- Observabilidad técnica (health checks, métricas).
- **11 de 12 fases del proyecto completadas.**

---

## Slide 12: Virtudes y diferenciales

- **Onboarding sin código**: nuevas máquinas, señales y dashboards se configuran, no se programan.
- **Arquitectura desacoplada**: el sistema habla con las máquinas a través de un "Data Provider" abstracto — hoy es un simulador, mañana será OPC UA real, sin tocar dashboards, alarmas ni históricos.
- **Multi-tenant desde el diseño**, no añadido después.
- **Rigor de ingeniería demostrable**: spec-driven, TDD, cobertura mínima forzada, seguridad revisada por feature — no solo "funciona", sino que está construido con un proceso verificable.

---

## Slide 13: A quién ayuda

- Empresas industriales que operan maquinaria y necesitan supervisión remota.
- Fabricantes de maquinaria que quieren ofrecer monitorización a sus clientes finales.
- Empresas de mantenimiento industrial.
- Ingenierías e integradores de sistemas industriales.

---

## Slide 14: Estado actual y trabajo futuro

- La base del sistema está completa y funcional de extremo a extremo, operando hoy sobre datos simulados realistas.
- Única fase pendiente: **integración OPC UA real**, que sustituirá al simulador de datos.
- Gracias al desacoplo del Data Provider, esa sustitución no requiere tocar dashboards, alarmas, históricos ni el resto del sistema ya construido.

---

## Slide 15: Conclusiones

- EWControl demuestra que es posible construir una plataforma industrial multi-tenant seria aplicando ingeniería de software rigurosa: arquitectura limpia, spec-driven development, TDD y seguridad por diseño.
- El sistema ya es funcional de extremo a extremo y está preparado para dar el salto a hardware real sin rediseño.
- El proyecto no es solo un prototipo: es una base productiva, verificable y extensible.

---

## Slide 16: Preguntas

- Gracias por la atención.
- Turno de preguntas.
