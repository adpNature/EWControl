import { describe, expect, it } from 'vitest';
import { shouldNotifyAlarmEvent } from './should-notify-alarm-event';

describe('shouldNotifyAlarmEvent', () => {
  it('notifica en AlarmTriggered cuando notifyByEmail es true', () => {
    expect(shouldNotifyAlarmEvent(true, 'AlarmTriggered')).toBe(true);
  });

  it('no notifica en AlarmTriggered cuando notifyByEmail es false', () => {
    expect(shouldNotifyAlarmEvent(false, 'AlarmTriggered')).toBe(false);
  });

  it('nunca notifica en AlarmCleared, incluso con notifyByEmail true', () => {
    expect(shouldNotifyAlarmEvent(true, 'AlarmCleared')).toBe(false);
  });
});
