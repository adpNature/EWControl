# Shared

Piezas de UI reutilizables entre features (Documento 12, apartados 12.4-12.5):

- `ui/input/` — `InputComponent` (`ControlValueAccessor`).
- `ui/table/` — `TableComponent`.
- `ui/toast/` — `ToastComponent` + `ToastService` (apilado máx. 3, auto-dismiss, `aria-live`).
- `ui/confirm-dialog/` — `ConfirmDialogComponent` (`role="alertdialog"`, foco al abrir, cierre por Escape/backdrop).
- `ui/icon/` — `IconComponent` (SVGs de Iconsax descargados manualmente, ver `public/icons/`).

Cada componente se crea al implementar la primera feature que lo necesite, no por adelantado.
