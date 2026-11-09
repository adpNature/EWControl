export type VariableUsage = { kind: 'Signal' | 'WritePackage'; id: string; name: string };
export type VariableInUse = { signalVariableName: string; usedBy: VariableUsage[] };

/**
 * spec 21: un guardado renombraría o quitaría variables que usan Signals o
 * paquetes de escritura activos; no se guarda nada.
 */
export class OpcUaVariableInUseError extends Error {
  constructor(readonly variables: VariableInUse[]) {
    super(
      `Hay variables en uso que no se pueden renombrar ni quitar: ${variables
        .map((variable) => variable.signalVariableName)
        .join(', ')}.`,
    );
    this.name = 'OpcUaVariableInUseError';
  }
}
