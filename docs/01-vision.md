# Visión del Proyecto

## ¿Qué es EWControl?

EWControl es una plataforma SaaS para la supervisión de maquinaria industrial.

Cada cliente podrá acceder únicamente a sus máquinas mediante un sistema de autenticación.

La plataforma permitirá visualizar datos en tiempo real, consultar históricos, gestionar alarmas y analizar el funcionamiento de la maquinaria.

---

# Público objetivo

Empresas industriales.

Fabricantes de maquinaria.

Empresas de mantenimiento.

Ingenierías.

Integradores industriales.

---

# Filosofía del proyecto

La plataforma no pretende sustituir un SCADA.

Su objetivo es ofrecer una solución web moderna para consultar información industrial desde cualquier dispositivo.

---

# Características principales

## Multiempresa

Cada cliente visualizará únicamente su información.

Toda la plataforma será multi-tenant.

---

## Dashboard dinámico

No existirán pantallas específicas para cada máquina.

Cada dashboard se generará automáticamente según la configuración de señales.

---

## Configuración dinámica

Cada máquina podrá publicar señales completamente diferentes.

No será necesario modificar el código para añadir nuevas variables.

---

## Históricos

Las señales configuradas podrán almacenarse para su consulta posterior.

Los históricos estarán optimizados mediante agregaciones automáticas.

---

## Alarmas

Cada señal podrá definir sus propios límites.

Las alarmas generarán:

- Notificación web.
- Correo electrónico.
- Histórico de eventos.

---

# Objetivos técnicos

Escalable.

Modular.

Desacoplado.

Mantenible.

Documentado.

---

# Roles

## Super Administrador

Gestiona toda la plataforma.

Puede acceder a cualquier cliente.

Gestiona usuarios.

Gestiona máquinas.

Visualiza estadísticas globales.

---

## Administrador de Cliente

Gestiona exclusivamente su empresa.

Puede:

- Crear máquinas.
- Configurar señales.
- Configurar alarmas.
- Consultar históricos.
- Visualizar dashboards.

---

# Alcance inicial

La primera versión se construye por fases incrementales, cada una especificada antes de programarse (Documento 0, "Spec-Driven Development"). El detalle y estado de cada fase está en el [README](../README.md), sección Roadmap; el orden acordado es:

1. Fundación backend: Simulador de datos ([Documento 10](10-simulador-datos-demo.md)) y catálogo de API REST ([Documento 11](11-api-rest.md)), sin interfaz propia.
2. Autenticación (login), como primera feature vertical Back+Front.
3. Gestión de clientes y máquinas.
4. Dashboard.
5. Históricos.
6. Alarmas.

La integración OPC UA (Documento 2, apartado 2.4; Documento 10, apartado 10.7) se incorporará una vez estabilizada la plataforma con estas fases, sustituyendo al Simulador sin modificar el resto del sistema.

---

# Objetivo de la arquitectura

Toda la aplicación debe permitir sustituir el origen de datos sin afectar al resto del sistema.

Actualmente:

Simulador

En el futuro:

Servidor OPC UA

Sin modificar Angular.

Sin modificar Alarmas.

Sin modificar Históricos.

Sin modificar Dashboard.