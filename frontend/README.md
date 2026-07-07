# Frontend

Este proyecto se generó con [Angular CLI](https://github.com/angular/angular-cli) versión 21.0.2.

## Servidor de desarrollo

Para levantar un servidor de desarrollo local, ejecuta:

```bash
pnpm start
```

Una vez el servidor esté en marcha, abre el navegador en `http://localhost:4200/`. La aplicación se recargará automáticamente al modificar cualquier archivo fuente.

## Generación de código (scaffolding)

Angular CLI incluye potentes herramientas de generación de código. Para generar un nuevo componente, ejecuta:

```bash
pnpm ng generate component nombre-componente
```

Para ver la lista completa de esquemas disponibles (como `components`, `directives` o `pipes`), ejecuta:

```bash
pnpm ng generate --help
```

## Compilación

Para compilar el proyecto, ejecuta:

```bash
pnpm build
```

Esto compila el proyecto y guarda los artefactos de build en el directorio `dist/`. Por defecto, el build de producción optimiza la aplicación para rendimiento y velocidad.

## Ejecutar tests unitarios

Para ejecutar los tests unitarios con el runner [Vitest](https://vitest.dev/), usa el siguiente comando:

```bash
pnpm test
```

## Ejecutar tests end-to-end

Para tests end-to-end (e2e) con [Playwright](https://playwright.dev/), ejecuta:

```bash
pnpm test:e2e
```

## Recursos adicionales

Para más información sobre el uso de Angular CLI, incluyendo la referencia detallada de comandos, visita la página de [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).
