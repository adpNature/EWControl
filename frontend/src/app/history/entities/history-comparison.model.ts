import { SignalHistoryPoint } from '../../core/websocket/realtime-events.model';

/** docs/specs/14-historicos-comparativas.md: serie de una Signal dentro de una comparativa. */
export interface SignalHistorySeries {
  signalId: string;
  machineId: string;
  points: SignalHistoryPoint[];
}

export interface HistoryComparisonResponse {
  resolution: string;
  series: SignalHistorySeries[];
}

/** Signal seleccionable en el picker cross-Machine, ya resuelta con su Machine. */
export interface SelectableSignal {
  machineId: string;
  machineName: string;
  signalId: string;
  signalName: string;
  unit: string;
}
