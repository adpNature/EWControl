# Alarms

Feature de gestión de alarmas en el Frontend (docs/specs/09-alarmas.md; Documento 8, apartado 8.5).

- `entities/` — modelos `AlarmDefinition`/`AlarmState`.
- `adapters/` — `AlarmDefinitionsApiService`/`AlarmStatesApiService` (REST, docs/11-api-rest.md).
- `use-cases/` — `AlarmDefinitionsState`/`AlarmStatesState` (estado de aplicación, patrón `SignalsState`).
- `pages/` — `alarm-definition-form-page` (alta/edición de reglas, enlazada desde `config/pages/signal-form-page`), y el futuro panel de alarmas de la Company.

El widget `ALARM_LIST` del Dashboard (`dashboard/widgets/alarm-list/`) y el panel de alarmas de la Company se implementan en slices posteriores de la misma spec.
