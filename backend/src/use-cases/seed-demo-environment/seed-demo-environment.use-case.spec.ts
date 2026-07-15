import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../entities/user-role.enum';
import { ProviderType } from '../../entities/provider-type.enum';
import { SignalType } from '../../entities/signal-type.enum';
import { MigrationsNotAppliedError } from './errors/migrations-not-applied.error';
import type { IUnitOfWork } from './ports/unit-of-work.port';
import {
  SEED_COMPANY_NAME,
  SEED_CONNECTION_CONFIG,
  SEED_MACHINE_NAME,
  SEED_SIGNALS,
  SEED_SUPERADMIN_EMAIL,
  SEED_SUPERADMIN_PASSWORD,
  SEED_USER_EMAIL,
  SEED_USER_PASSWORD,
} from './seed-demo-environment.config';
import { SeedDemoEnvironmentUseCase } from './seed-demo-environment.use-case';

const HASHED_PASSWORD = 'hashed:Demo1234!';
const HASHED_SUPERADMIN_PASSWORD = 'hashed:SuperAdmin1234!';
const FAKE_CTX = Symbol('tx-ctx');

function createFakes() {
  const companyRepository = {
    findByName: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'company-1', name: SEED_COMPANY_NAME }),
  };
  const userRepository = {
    create: vi.fn().mockResolvedValue({ id: 'user-1' }),
  };
  const machineRepository = {
    create: vi.fn().mockResolvedValue({ id: 'machine-1', name: SEED_MACHINE_NAME }),
    findById: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
  };
  const machineConnectionRepository = {
    create: vi.fn().mockResolvedValue({ id: 'connection-1' }),
    findByMachineId: vi.fn(),
    findAllByProviderType: vi.fn(),
    replace: vi.fn(),
  };
  const signalRepository = {
    create: vi.fn().mockResolvedValue({ id: 'signal-x' }),
    findById: vi.fn(),
    findAllByMachineId: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    softDeactivate: vi.fn(),
    deactivateAllByMachineId: vi.fn(),
  };
  const passwordHasher = {
    hash: vi.fn((plain: string) =>
      Promise.resolve(
        plain === SEED_SUPERADMIN_PASSWORD ? HASHED_SUPERADMIN_PASSWORD : HASHED_PASSWORD,
      ),
    ),
    compare: vi.fn(),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const schemaReadinessChecker = {
    ensureReady: vi.fn().mockResolvedValue(undefined),
  };

  return {
    companyRepository,
    userRepository,
    machineRepository,
    machineConnectionRepository,
    signalRepository,
    passwordHasher,
    unitOfWork,
    schemaReadinessChecker,
  };
}

function createUseCase(fakes: ReturnType<typeof createFakes>) {
  return new SeedDemoEnvironmentUseCase(
    fakes.companyRepository,
    fakes.userRepository,
    fakes.machineRepository,
    fakes.machineConnectionRepository,
    fakes.signalRepository,
    fakes.passwordHasher,
    fakes.unitOfWork as unknown as IUnitOfWork,
    fakes.schemaReadinessChecker,
  );
}

describe('SeedDemoEnvironmentUseCase', () => {
  let fakes: ReturnType<typeof createFakes>;

  beforeEach(() => {
    fakes = createFakes();
  });

  it('crea Company, dos Users (AdminCliente + SuperAdmin), Machine, MachineConnection y 6 Signals dentro de la misma transacción', async () => {
    const useCase = createUseCase(fakes);

    const result = await useCase.execute();

    expect(result).toEqual({ created: true });

    expect(fakes.companyRepository.create).toHaveBeenCalledWith(
      { name: SEED_COMPANY_NAME },
      FAKE_CTX,
    );

    expect(fakes.passwordHasher.hash).toHaveBeenCalledWith(SEED_USER_PASSWORD);
    expect(fakes.userRepository.create).toHaveBeenCalledTimes(2);
    expect(fakes.userRepository.create).toHaveBeenCalledWith(
      {
        companyId: 'company-1',
        email: SEED_USER_EMAIL,
        passwordHash: HASHED_PASSWORD,
        role: UserRole.AdminCliente,
      },
      FAKE_CTX,
    );

    expect(fakes.passwordHasher.hash).toHaveBeenCalledWith(SEED_SUPERADMIN_PASSWORD);
    expect(fakes.userRepository.create).toHaveBeenCalledWith(
      {
        companyId: 'company-1',
        email: SEED_SUPERADMIN_EMAIL,
        passwordHash: HASHED_SUPERADMIN_PASSWORD,
        role: UserRole.SuperAdmin,
      },
      FAKE_CTX,
    );

    expect(fakes.machineRepository.create).toHaveBeenCalledWith(
      { companyId: 'company-1', name: SEED_MACHINE_NAME },
      FAKE_CTX,
    );

    expect(fakes.machineConnectionRepository.create).toHaveBeenCalledWith(
      {
        machineId: 'machine-1',
        providerType: ProviderType.Simulator,
        connectionConfig: SEED_CONNECTION_CONFIG,
      },
      FAKE_CTX,
    );

    expect(fakes.signalRepository.create).toHaveBeenCalledTimes(6);
    for (const seedSignal of SEED_SIGNALS) {
      expect(fakes.signalRepository.create).toHaveBeenCalledWith(
        {
          machineId: 'machine-1',
          name: seedSignal.name,
          signalType: SignalType.DIRECT,
          signalSource: { variableName: seedSignal.name },
          unit: seedSignal.unit,
          historyEnabled: true,
        },
        FAKE_CTX,
      );
    }
  });

  it('nunca almacena la contraseña en texto plano', async () => {
    const useCase = createUseCase(fakes);

    await useCase.execute();

    const [userData] = fakes.userRepository.create.mock.calls[0];
    expect(userData.passwordHash).toBe(HASHED_PASSWORD);
    expect(userData.passwordHash).not.toBe(SEED_USER_PASSWORD);
  });

  it('es idempotente: si la Company demo ya existe, no crea nada más', async () => {
    fakes.companyRepository.findByName.mockResolvedValue({
      id: 'company-1',
      name: SEED_COMPANY_NAME,
    });
    const useCase = createUseCase(fakes);

    const result = await useCase.execute();

    expect(result).toEqual({ created: false });
    expect(fakes.companyRepository.create).not.toHaveBeenCalled();
    expect(fakes.userRepository.create).not.toHaveBeenCalled();
    expect(fakes.machineRepository.create).not.toHaveBeenCalled();
    expect(fakes.machineConnectionRepository.create).not.toHaveBeenCalled();
    expect(fakes.signalRepository.create).not.toHaveBeenCalled();
  });

  it('falla antes de abrir una transacción si las migraciones no están aplicadas', async () => {
    fakes.schemaReadinessChecker.ensureReady.mockRejectedValue(new MigrationsNotAppliedError());
    const useCase = createUseCase(fakes);

    await expect(useCase.execute()).rejects.toBeInstanceOf(MigrationsNotAppliedError);
    expect(fakes.unitOfWork.runInTransaction).not.toHaveBeenCalled();
  });

  it('propaga el error sin capturarlo si una creación falla a mitad de la operación', async () => {
    const failure = new Error('boom');
    fakes.signalRepository.create.mockRejectedValueOnce(failure);
    const useCase = createUseCase(fakes);

    await expect(useCase.execute()).rejects.toBe(failure);
  });
});
