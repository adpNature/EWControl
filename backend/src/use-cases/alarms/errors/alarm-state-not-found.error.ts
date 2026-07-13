export class AlarmStateNotFoundError extends Error {
  constructor(alarmStateId: string) {
    super(`No existe el AlarmState ${alarmStateId}.`);
    this.name = 'AlarmStateNotFoundError';
  }
}
