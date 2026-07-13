export class AlarmDefinitionNotFoundError extends Error {
  constructor(alarmDefinitionId: string) {
    super(`No existe la AlarmDefinition ${alarmDefinitionId}.`);
    this.name = 'AlarmDefinitionNotFoundError';
  }
}
