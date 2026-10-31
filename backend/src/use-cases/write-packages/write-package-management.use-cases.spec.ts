import { describe, expect, it, vi } from 'vitest';
import { MachineNotFoundError } from '../machine-management/errors/machine-not-found.error';
import { InvalidWritePackageError } from './errors/invalid-write-package.error';
import { WritePackageNameTakenError } from './errors/write-package-name-taken.error';
import { WritePackageNotFoundError } from './errors/write-package-not-found.error';
import {
  CreateWritePackageUseCase,
  DeactivateWritePackageUseCase,
  GetWritePackageUseCase,
  ListWritePackageExecutionsUseCase,
  ListWritePackagesUseCase,
  UpdateWritePackageUseCase,
} from './write-package-management.use-cases';
import {
  FAKE_CTX,
  PACKAGE,
  REQUESTER,
  createAccessFakes,
} from '../../../test/support/write-package-fakes';

describe('CreateWritePackageUseCase', () => {
  function createUseCase(fakes = createAccessFakes()) {
    return {
      fakes,
      useCase: new CreateWritePackageUseCase(
        fakes.access,
        fakes.writePackageRepository as never,
        fakes.unitOfWork,
      ),
    };
  }

  it('crea el paquete con nombre recortado y descripción null por defecto (criterio 2)', async () => {
    const { fakes, useCase } = createUseCase();

    await useCase.execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      name: '  Formato 120 mm ',
      items: PACKAGE.items,
    });

    expect(fakes.writePackageRepository.create).toHaveBeenCalledWith(
      { machineId: 'machine-1', name: 'Formato 120 mm', description: null, items: PACKAGE.items },
      FAKE_CTX,
    );
  });

  it('rechaza un valor fuera de límites con InvalidWritePackageError indicando el elemento', async () => {
    const { fakes, useCase } = createUseCase();

    const promise = useCase.execute({
      machineId: 'machine-1',
      requester: REQUESTER,
      name: 'Malo',
      items: [
        { signalVariableName: 'Escritura_BOOL', value: true },
        { signalVariableName: 'Escritura_REAL', value: 9999 },
      ],
    });

    await expect(promise).rejects.toBeInstanceOf(InvalidWritePackageError);
    await expect(promise).rejects.toMatchObject({ index: 1 });
    expect(fakes.writePackageRepository.create).not.toHaveBeenCalled();
  });

  it('una Machine sin conexión no tiene variables escribibles', async () => {
    const { useCase } = createUseCase(createAccessFakes({ providerType: null }));

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        name: 'X',
        items: PACKAGE.items,
      }),
    ).rejects.toBeInstanceOf(InvalidWritePackageError);
  });

  it('rechaza un nombre ya usado por otro paquete activo de la Machine', async () => {
    const fakes = createAccessFakes();
    fakes.writePackageRepository.findActiveByMachineAndName.mockResolvedValue(PACKAGE);
    const { useCase } = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        name: 'Formato 120 mm',
        items: PACKAGE.items,
      }),
    ).rejects.toBeInstanceOf(WritePackageNameTakenError);
  });

  it('propaga MachineNotFoundError para una Machine de otra Company (criterio 3)', async () => {
    const fakes = createAccessFakes();
    fakes.machineAccessResolver.resolveActive.mockRejectedValue(
      new MachineNotFoundError('machine-1'),
    );
    const { useCase } = createUseCase(fakes);

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        requester: REQUESTER,
        name: 'X',
        items: PACKAGE.items,
      }),
    ).rejects.toBeInstanceOf(MachineNotFoundError);
  });
});

describe('UpdateWritePackageUseCase', () => {
  function createUseCase(fakes = createAccessFakes()) {
    return {
      fakes,
      useCase: new UpdateWritePackageUseCase(
        fakes.access,
        fakes.writePackageRepository as never,
        fakes.unitOfWork,
      ),
    };
  }

  it('actualiza nombre e items revalidando los items', async () => {
    const { fakes, useCase } = createUseCase();
    const items = [{ signalVariableName: 'Escritura_REAL', value: 80 }];

    await useCase.execute({
      machineId: 'machine-1',
      packageId: 'package-1',
      requester: REQUESTER,
      changes: { name: 'Formato 80 mm', items },
    });

    expect(fakes.writePackageRepository.update).toHaveBeenCalledWith(
      'package-1',
      { name: 'Formato 80 mm', items },
      FAKE_CTX,
    );
  });

  it('rechaza items inválidos', async () => {
    const { useCase } = createUseCase();

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        packageId: 'package-1',
        requester: REQUESTER,
        changes: { items: [{ signalVariableName: 'Escritura_BOOL', value: 'sí' }] },
      }),
    ).rejects.toBeInstanceOf(InvalidWritePackageError);
  });

  it('rechaza renombrar a un nombre que ya usa otro paquete, pero no a sí mismo', async () => {
    const fakes = createAccessFakes();
    const { useCase } = createUseCase(fakes);
    fakes.writePackageRepository.findActiveByMachineAndName.mockResolvedValue({
      ...PACKAGE,
      id: 'package-2',
    });

    await expect(
      useCase.execute({
        machineId: 'machine-1',
        packageId: 'package-1',
        requester: REQUESTER,
        changes: { name: 'Otro' },
      }),
    ).rejects.toBeInstanceOf(WritePackageNameTakenError);

    await useCase.execute({
      machineId: 'machine-1',
      packageId: 'package-1',
      requester: REQUESTER,
      changes: { name: PACKAGE.name, description: 'Nueva descripción' },
    });
    expect(fakes.writePackageRepository.update).toHaveBeenCalledTimes(1);
  });

  it('un paquete de otra Machine o dado de baja no existe', async () => {
    const fakes = createAccessFakes();
    const { useCase } = createUseCase(fakes);
    fakes.writePackageRepository.findById.mockResolvedValueOnce({ ...PACKAGE, machineId: 'otra' });
    fakes.writePackageRepository.findById.mockResolvedValueOnce({ ...PACKAGE, isActive: false });

    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(
        useCase.execute({
          machineId: 'machine-1',
          packageId: 'package-1',
          requester: REQUESTER,
          changes: { name: 'X' },
        }),
      ).rejects.toBeInstanceOf(WritePackageNotFoundError);
    }
  });
});

describe('DeactivateWritePackageUseCase / ListWritePackagesUseCase / GetWritePackageUseCase', () => {
  it('da de baja el paquete', async () => {
    const fakes = createAccessFakes();
    const useCase = new DeactivateWritePackageUseCase(
      fakes.access,
      fakes.writePackageRepository as never,
      fakes.unitOfWork,
    );

    await useCase.execute({ machineId: 'machine-1', packageId: 'package-1', requester: REQUESTER });

    expect(fakes.writePackageRepository.deactivate).toHaveBeenCalledWith('package-1', FAKE_CTX);
  });

  it('lista los paquetes activos de la Machine con su proveedor y estado de conexión', async () => {
    const fakes = createAccessFakes();
    const machineWriter = { isConnected: vi.fn().mockReturnValue(true), write: vi.fn() };
    const useCase = new ListWritePackagesUseCase(
      fakes.access,
      fakes.writePackageRepository as never,
      machineWriter,
      fakes.unitOfWork,
    );

    await expect(
      useCase.execute({ machineId: 'machine-1', requester: REQUESTER }),
    ).resolves.toEqual({
      providerType: 'OpcUa',
      connected: true,
      packages: [PACKAGE],
    });
    expect(machineWriter.isConnected).toHaveBeenCalledWith('machine-1');
    expect(fakes.writePackageRepository.listActiveByMachine).toHaveBeenCalledWith(
      'machine-1',
      FAKE_CTX,
    );
  });

  it('devuelve el detalle de un paquete', async () => {
    const fakes = createAccessFakes();
    const useCase = new GetWritePackageUseCase(fakes.access, fakes.unitOfWork);

    await expect(
      useCase.execute({ machineId: 'machine-1', packageId: 'package-1', requester: REQUESTER }),
    ).resolves.toEqual(PACKAGE);
  });
});

describe('ListWritePackageExecutionsUseCase', () => {
  it('pagina el historial, también de un paquete dado de baja (criterio 8)', async () => {
    const fakes = createAccessFakes();
    fakes.writePackageRepository.findById.mockResolvedValue({ ...PACKAGE, isActive: false });
    const executionRepository = {
      create: vi.fn(),
      listByPackage: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    };
    const useCase = new ListWritePackageExecutionsUseCase(
      fakes.access,
      executionRepository,
      fakes.unitOfWork,
    );

    const result = await useCase.execute({
      machineId: 'machine-1',
      packageId: 'package-1',
      requester: REQUESTER,
      pagination: { limit: 20, offset: 0 },
    });

    expect(result).toEqual({ data: [], total: 0, limit: 20, offset: 0 });
    expect(executionRepository.listByPackage).toHaveBeenCalledWith(
      'package-1',
      { limit: 20, offset: 0 },
      FAKE_CTX,
    );
  });
});
