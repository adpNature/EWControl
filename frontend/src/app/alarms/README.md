# Alarms

Feature de gestión de alarmas en el Frontend (docs/specs/09-alarmas.md, docs/specs/11-ack-alarmas.md; Documento 8, apartado 8.5).

- `entities/` — modelos `AlarmDefinition`/`AlarmState` (este último incluye el reconocimiento manual: `ackedAt`/`ackedByUserId`/`ackedByEmail`).
- `adapters/` — `AlarmDefinitionsApiService`/`AlarmStatesApiService` (REST, docs/11-api-rest.md; `AlarmStatesApiService.ack()` reconoce una alarma).
- `use-cases/` — `AlarmDefinitionsState`/`AlarmStatesState` (estado de aplicación, patrón `SignalsState`; `AlarmStatesState.ack()`/`applyAcked()` cubren el reconocimiento manual).
- `pages/` — `alarm-definition-form-page` (alta/edición de reglas, enlazada desde `config/pages/signal-form-page`), `alarm-panel-page` (panel de alarmas de la Company) y `alarm-detail-page` (detalle e histórico de una alarma), ambas con la acción "Reconocer".

El widget `ALARM_LIST` del Dashboard (`dashboard/widgets/alarm-list/`) permanece de solo lectura: no ofrece la acción de reconocimiento (docs/specs/11-ack-alarmas.md, "Alcance explícito").
