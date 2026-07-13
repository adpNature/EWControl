import { describe, expect, it, vi } from 'vitest';
import { AlarmTriggeredNotificationListener } from './alarm-triggered-notification.listener';

describe('AlarmTriggeredNotificationListener', () => {
  it('delega en NotifyAlarmTriggeredUseCase con el payload recibido', () => {
    const notifyAlarmTriggered = { execute: vi.fn().mockResolvedValue(undefined) };
    const listener = new AlarmTriggeredNotificationListener(notifyAlarmTriggered as never);
    const payload = {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      companyId: 'company-1',
      priority: 'HIGH' as const,
      value: 84,
      timestamp: new Date('2026-01-01T00:00:00Z'),
    };

    listener.handle(payload);

    expect(notifyAlarmTriggered.execute).toHaveBeenCalledWith(payload);
  });
});
