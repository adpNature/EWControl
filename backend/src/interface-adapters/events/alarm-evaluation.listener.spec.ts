import { describe, expect, it, vi } from 'vitest';
import { SignalQuality } from '../../entities/signal-quality.enum';
import { AlarmEvaluationListener } from './alarm-evaluation.listener';

describe('AlarmEvaluationListener', () => {
  it('delega en EvaluateAlarmRulesUseCase con los campos del SignalUpdated', () => {
    const evaluateAlarmRules = { execute: vi.fn().mockResolvedValue(undefined) };
    const listener = new AlarmEvaluationListener(evaluateAlarmRules as never);
    const payload = {
      signalId: 'signal-1',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 84,
      quality: SignalQuality.Good,
      timestamp: new Date('2026-01-01T00:00:00Z'),
      correlationId: 'correlation-1',
    };

    listener.handle(payload);

    expect(evaluateAlarmRules.execute).toHaveBeenCalledWith({
      signalId: 'signal-1',
      companyId: 'company-1',
      value: 84,
      quality: SignalQuality.Good,
      timestamp: payload.timestamp,
    });
  });
});
