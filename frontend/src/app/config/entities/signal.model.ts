/** Documento 3, apartado 3.2.5. */
export type SignalType = 'DIRECT' | 'FORMULA';

export type SignalSource = { variableName: string } | { expression: string; variables: string[] };

export interface Signal {
  id: string;
  machineId: string;
  name: string;
  signalType: SignalType;
  signalSource: SignalSource;
  unit: string;
  historyEnabled: boolean;
}

export interface CreateSignalRequest {
  name: string;
  signalType: SignalType;
  signalSource: SignalSource;
  unit: string;
}

export type UpdateSignalRequest = Partial<CreateSignalRequest>;
