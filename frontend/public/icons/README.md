# Iconos

Esta carpeta contiene únicamente los SVGs del set **gratuito** de [Iconsax](https://iconsax.io) ("Essential"/"Linear"), descargados manualmente uno a uno — nunca un paquete npm de terceros que mezcle iconos gratuitos y de pago. Motivo completo de esta decisión: `docs/12-convenciones-frontend.md`, apartado 12.5.

## Cómo añadir un icono nuevo

1. Descargar el `.svg` del icono deseado desde iconsax.io, **verificando que pertenece al set gratuito**.
2. Guardarlo aquí con nombre en kebab-case (ej. `alert-circle.svg`).
3. Usarlo en cualquier componente: `<app-icon name="alert-circle" label="Alerta" />` (con `label` si es el único contenido de un control interactivo; sin `label` si es decorativo, ver `shared/ui/icon/icon.component.ts`).

Esta carpeta está vacía intencionadamente hasta que la primera feature vertical necesite su primer icono real.
