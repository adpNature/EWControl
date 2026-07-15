import { describe, expect, it, vi } from 'vitest';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { NestEventEmitterPublisher } from './nest-event-emitter.publisher';

describe('NestEventEmitterPublisher', () => {
  it('delega publish en EventEmitter2.emit con el nombre y payload exactos', () => {
    const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
    const publisher = new NestEventEmitterPublisher(emitter);
    const payload = {
      machineId: 'machine-1',
      companyId: 'company-1',
      timestamp: new Date('2026-01-01T00:00:00Z'),
    };

    publisher.publish('MachineDisconnected', payload);

    expect(emitter.emit).toHaveBeenCalledWith('MachineDisconnected', payload);
    expect(emitter.emit).toHaveBeenCalledTimes(1);
  });

  it('delega publish de SignalUpdated en EventEmitter2.emit (docs/specs/07-dashboard-tiempo-real.md)', () => {
    const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
    const publisher = new NestEventEmitterPublisher(emitter);
    const payload = {
      signalId: 'signal-1',
      machineId: 'machine-1',
      companyId: 'company-1',
      value: 42,
      quality: 'GOOD' as const,
      timestamp: new Date('2026-01-01T00:00:00Z'),
    };

    publisher.publish('SignalUpdated', payload as never);

    expect(emitter.emit).toHaveBeenCalledWith('SignalUpdated', payload);
  });

  it('delega publish de AlarmTriggered en EventEmitter2.emit (docs/specs/09-alarmas.md)', () => {
    const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
    const publisher = new NestEventEmitterPublisher(emitter);
    const payload = {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      companyId: 'company-1',
      priority: 'HIGH' as const,
      value: 84,
      timestamp: new Date('2026-01-01T00:00:00Z'),
    };

    publisher.publish('AlarmTriggered', payload);

    expect(emitter.emit).toHaveBeenCalledWith('AlarmTriggered', payload);
  });

  it('delega publish de AlarmCleared en EventEmitter2.emit (docs/specs/09-alarmas.md)', () => {
    const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
    const publisher = new NestEventEmitterPublisher(emitter);
    const payload = {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      companyId: 'company-1',
      timestamp: new Date('2026-01-01T00:00:00Z'),
    };

    publisher.publish('AlarmCleared', payload);

    expect(emitter.emit).toHaveBeenCalledWith('AlarmCleared', payload);
  });

  it('delega publish de AlarmAcked en EventEmitter2.emit (docs/specs/11-ack-alarmas.md)', () => {
    const emitter = { emit: vi.fn() } as unknown as EventEmitter2;
    const publisher = new NestEventEmitterPublisher(emitter);
    const payload = {
      alarmStateId: 'state-1',
      alarmDefinitionId: 'def-1',
      signalId: 'signal-1',
      companyId: 'company-1',
      ackedByUserId: 'user-1',
      ackedByEmail: 'admin@ewcontrol.local',
      ackedAt: new Date('2026-01-01T00:00:00Z'),
    };

    publisher.publish('AlarmAcked', payload);

    expect(emitter.emit).toHaveBeenCalledWith('AlarmAcked', payload);
  });
});
