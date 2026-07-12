import { describe, expect, it, vi } from 'vitest';
import { MachineDisconnectedListener } from './machine-disconnected.listener';

describe('MachineDisconnectedListener', () => {
  it('delega en MarkMachineSignalsOfflineUseCase con machineId/companyId del payload', async () => {
    const markSignalsOffline = { execute: vi.fn().mockResolvedValue(undefined) };
    const listener = new MachineDisconnectedListener(markSignalsOffline as never);

    await listener.handle({
      machineId: 'machine-1',
      companyId: 'company-1',
      timestamp: new Date('2026-07-12T10:00:00Z'),
    });

    expect(markSignalsOffline.execute).toHaveBeenCalledWith({
      machineId: 'machine-1',
      companyId: 'company-1',
    });
  });
});
