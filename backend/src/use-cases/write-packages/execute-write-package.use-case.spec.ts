import { describe, expect, it, vi } from 'vitest';
import { ProviderType } from '../../entities/provider-type.enum';
import { ProviderNotSupportedError } from '../machine-management/errors/provider-not-supported.error';
import { MachineNotConnectedError } from './errors/machine-not-connected.error';
import { WriteInProgressError } from './errors/write-in-progress.error';
import { WritePackageNotFoundError } from './errors/write-package-not-found.error';
import { WritePackageOutdatedError } from './errors/write-package-outdated.error';
import { WriteTimeoutError } from './errors/write-timeout.error';
import { ExecuteWritePackageUseCase } from './execute-write-package.use-case';
import {
  OPCUA_CONFIG,
  REQUESTER,
  createAccessFakes,
} from '../../../test/support/write-package-fakes';

const NOW = new Date('2026-10-30T12:00:00Z');
const EXECUTED_BY = { userId: 'user-op', email: 'operador@ewcontrol.local' };
const INPUT = {
  machineId: 'machine-1',
  packageId: 'package-1',
  requester: REQUESTER,
  executedBy: EXECUTED_BY,
};

function createUseCase(access = createAccessFakes()) {
  const executionRepository = {
    create: vi.fn((data: object) => Promise.resolve({ id: 'execution-1', ...data })),
    listByPackage: vi.fn(),
  };
  const machineWriter = {
    write: vi.fn().mockResolvedValue([
      { nodeId: 'ns=3;s="Escritura"."REAL"', statusCode: 'Good' },
      { nodeId: 'ns=3;s="Escritura"."BOOL"', statusCode: 'Good' },
    ]),
  };
  const eventPublisher = { publish: vi.fn() };
  const metricsRecorder = {
    recordHistoryWriteError: vi.fn(),
    recordWritePackageExecution: vi.fn(),
  };
  const useCase = new ExecuteWritePackageUseCase(
    access.access,
    executionRepository,
    machineWriter,
    access.unitOfWork,
    { now: () => NOW },
    eventPublisher,
    metricsRecorder,
  );
  return { access, executionRepository, machineWriter, eventPublisher, metricsRecorder, useCase };
}

describe('ExecuteWritePackageUseCase', () => {
  it('escribe todos los valores en una sola petición con nodeId y dataType de la config (criterio 4)', async () => {
    const { machineWriter, useCase } = createUseCase();

    await useCase.execute(INPUT);

    expect(machineWriter.write).toHaveBeenCalledTimes(1);
    expect(machineWriter.write).toHaveBeenCalledWith('machine-1', [
      { nodeId: 'ns=3;s="Escritura"."REAL"', dataType: 'Float', value: 120 },
      { nodeId: 'ns=3;s="Escritura"."BOOL"', dataType: 'Boolean', value: true },
    ]);
  });

  it('registra la ejecución SUCCESS con quién, cuándo y el StatusCode de cada valor (criterio 8)', async () => {
    const { executionRepository, eventPublisher, metricsRecorder, useCase } = createUseCase();

    const execution = await useCase.execute(INPUT);

    expect(executionRepository.create).toHaveBeenCalledWith(
      {
        packageId: 'package-1',
        machineId: 'machine-1',
        companyId: 'company-1',
        userId: 'user-op',
        userEmail: 'operador@ewcontrol.local',
        executedAt: NOW,
        status: 'SUCCESS',
        reason: null,
        items: [
          {
            signalVariableName: 'Escritura_REAL',
            nodeId: 'ns=3;s="Escritura"."REAL"',
            value: 120,
            statusCode: 'Good',
          },
          {
            signalVariableName: 'Escritura_BOOL',
            nodeId: 'ns=3;s="Escritura"."BOOL"',
            value: true,
            statusCode: 'Good',
          },
        ],
      },
      expect.anything(),
    );
    expect(execution.id).toBe('execution-1');
    expect(metricsRecorder.recordWritePackageExecution).toHaveBeenCalledWith('SUCCESS');
    expect(eventPublisher.publish).toHaveBeenCalledWith('WritePackageExecuted', {
      executionId: 'execution-1',
      packageId: 'package-1',
      machineId: 'machine-1',
      companyId: 'company-1',
      status: 'SUCCESS',
    });
  });

  it('un rechazo parcial del servidor da PARTIAL y uno total FAILED, sin revertir (criterio 7)', async () => {
    const { machineWriter, executionRepository, useCase } = createUseCase();
    machineWriter.write.mockResolvedValueOnce([
      { nodeId: 'a', statusCode: 'Good' },
      { nodeId: 'b', statusCode: 'BadNotWritable' },
    ]);
    machineWriter.write.mockResolvedValueOnce([
      { nodeId: 'a', statusCode: 'BadTypeMismatch' },
      { nodeId: 'b', statusCode: 'BadNotWritable' },
    ]);

    await useCase.execute(INPUT);
    await useCase.execute(INPUT);

    const statuses = executionRepository.create.mock.calls.map(
      ([data]) => (data as { status: string }).status,
    );
    expect(statuses).toEqual(['PARTIAL', 'FAILED']);
  });

  it('un paquete desfasado respecto a la config actual da 409 sin escribir, y se registra FAILED (criterio 5)', async () => {
    const outdated = {
      ...OPCUA_CONFIG,
      nodeMapping: OPCUA_CONFIG.nodeMapping.map((entry) => ({ ...entry, writable: false })),
    };
    const { machineWriter, executionRepository, useCase } = createUseCase(
      createAccessFakes({ config: outdated }),
    );

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(WritePackageOutdatedError);

    expect(machineWriter.write).not.toHaveBeenCalled();
    expect(executionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', reason: 'WRITE_PACKAGE_OUTDATED' }),
      expect.anything(),
    );
  });

  it('una Machine del Simulador da 422 sin escribir y se registra (criterio 6)', async () => {
    const { machineWriter, executionRepository, useCase } = createUseCase(
      createAccessFakes({
        providerType: ProviderType.Simulator,
        config: { seedProfile: 'x', signals: [] },
      }),
    );

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(ProviderNotSupportedError);

    expect(machineWriter.write).not.toHaveBeenCalled();
    expect(executionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', reason: 'PROVIDER_NOT_SUPPORTED' }),
      expect.anything(),
    );
  });

  it.each([
    [new MachineNotConnectedError('machine-1'), MachineNotConnectedError, 'MACHINE_NOT_CONNECTED'],
    [new WriteInProgressError('machine-1'), WriteInProgressError, 'WRITE_IN_PROGRESS'],
  ])(
    'si el escritor lanza %s se registra FAILED con su motivo y se propaga (criterio 6)',
    async (error, errorClass, reason) => {
      const { machineWriter, executionRepository, useCase } = createUseCase();
      machineWriter.write.mockRejectedValue(error);

      await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(errorClass);

      expect(executionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'FAILED',
          reason,
          items: [
            expect.objectContaining({ statusCode: 'NOT_SENT', nodeId: null }),
            expect.objectContaining({ statusCode: 'NOT_SENT', nodeId: null }),
          ],
        }),
        expect.anything(),
      );
    },
  );

  it('un timeout del servidor deja la ejecución FAILED con motivo TIMEOUT y no lanza', async () => {
    const { machineWriter, executionRepository, useCase } = createUseCase();
    machineWriter.write.mockRejectedValue(new WriteTimeoutError());

    const execution = await useCase.execute(INPUT);

    expect(execution).toMatchObject({ status: 'FAILED', reason: 'TIMEOUT' });
    expect(executionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({ statusCode: 'TIMEOUT' }),
          expect.objectContaining({ statusCode: 'TIMEOUT' }),
        ],
      }),
      expect.anything(),
    );
  });

  it('un error inesperado del escritor se propaga sin registrar', async () => {
    const { machineWriter, executionRepository, useCase } = createUseCase();
    machineWriter.write.mockRejectedValue(new Error('boom'));

    await expect(useCase.execute(INPUT)).rejects.toThrow('boom');
    expect(executionRepository.create).not.toHaveBeenCalled();
  });

  it('un paquete inexistente da WritePackageNotFoundError sin registrar nada', async () => {
    const access = createAccessFakes();
    access.writePackageRepository.findById.mockResolvedValue(null);
    const { executionRepository, useCase } = createUseCase(access);

    await expect(useCase.execute(INPUT)).rejects.toBeInstanceOf(WritePackageNotFoundError);
    expect(executionRepository.create).not.toHaveBeenCalled();
  });
});
