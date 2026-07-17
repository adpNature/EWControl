# History

Pantalla independiente de Históricos y comparativas multi-Signal/Machine (docs/specs/14-historicos-comparativas.md), distinta del widget `CHART` del Dashboard (docs/specs/08-historicos.md), que no se modifica.

- `entities/` — `HistoryComparisonResponse`/`SignalHistorySeries` (respuesta del endpoint batch) y `SelectableSignal` (catálogo del picker).
- `adapters/` — `HistoryApiService` (`GET /signals/history`, docs/11-api-rest.md).
- `use-cases/` — `HistoryComparisonState` (selección de Signals, comparativa cargada, error) y `history-breadcrumbs.ts`.
- `pages/history-page/` — página única: selector de Company obligatorio para un `SuperAdmin` (nunca visible para un `AdminCliente`), `signal-picker/` (selector de Signals cross-Machine, hasta 8 a la vez) y `multi-series-chart/` (gráfico SVG comparativo, cada serie normalizada a su propio rango).
