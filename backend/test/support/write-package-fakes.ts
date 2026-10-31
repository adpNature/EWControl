import { vi } from 'vitest';
import type { OpcUaConnectionConfig } from '../../src/entities/connection-config.vo';
import { ProviderType } from '../../src/entities/provider-type.enum';
import { UserRole } from '../../src/entities/user-role.enum';
import { WritePackageAccessResolver } from '../../src/use-cases/write-packages/write-package-access.resolver';

/** Fakes compartidos por los specs de `write-packages` (no es código de producción). */
export const FAKE_CTX = Symbol('tx-ctx');
export const REQUESTER = { companyId: 'company-1', role: UserRole.Operador };
export const MACHINE = {
  id: 'machine-1',
  companyId: 'company-1',
  name: 'Bobinadora',
  isActive: true,
};

export const OPCUA_CONFIG: OpcUaConnectionConfig = {
  endpointUrl: 'opc.tcp://192.168.1.1:4840',
  securityMode: 'None',
  securityPolicy: 'None',
  authMode: 'Anonymous',
  timeoutMs: 5000,
  samplingIntervalMs: 1000,
  nodeMapping: [
    {
      nodeId: 'ns=3;s="Escritura"."REAL"',
      signalVariableName: 'Escritura_REAL',
      writable: true,
      dataType: 'Float',
      min: 0,
      max: 500,
    },
    {
      nodeId: 'ns=3;s="Escritura"."BOOL"',
      signalVariableName: 'Escritura_BOOL',
      writable: true,
      dataType: 'Boolean',
    },
  ],
};

export const PACKAGE = {
  id: 'package-1',
  machineId: 'machine-1',
  name: 'Formato 120 mm',
  description: null,
  items: [
    { signalVariableName: 'Escritura_REAL', value: 120 },
    { signalVariableName: 'Escritura_BOOL', value: true },
  ],
  isActive: true,
  createdAt: new Date('2026-10-30T10:00:00Z'),
  updatedAt: new Date('2026-10-30T10:00:00Z'),
};

export function createAccessFakes(
  options: { providerType?: ProviderType | null; config?: unknown } = {},
) {
  const machineAccessResolver = { resolveActive: vi.fn().mockResolvedValue(MACHINE) };
  const providerType =
    options.providerType === undefined ? ProviderType.OpcUa : options.providerType;
  const machineConnectionRepository = {
    findByMachineId: vi.fn().mockResolvedValue(
      providerType === null
        ? null
        : {
            machineId: 'machine-1',
            providerType,
            connectionConfig: options.config ?? OPCUA_CONFIG,
          },
    ),
  };
  const writePackageRepository = {
    create: vi.fn((data: object) =>
      Promise.resolve({ id: 'package-new', isActive: true, ...data }),
    ),
    findById: vi.fn().mockResolvedValue(PACKAGE),
    findActiveByMachineAndName: vi.fn().mockResolvedValue(null),
    listActiveByMachine: vi.fn().mockResolvedValue([PACKAGE]),
    update: vi.fn((id: string, changes: object) => Promise.resolve({ ...PACKAGE, id, ...changes })),
    deactivate: vi.fn().mockResolvedValue(undefined),
  };
  const unitOfWork = {
    runInTransaction: vi.fn((work: (ctx: unknown) => Promise<unknown>) => work(FAKE_CTX)),
  };
  const access = new WritePackageAccessResolver(
    machineAccessResolver as never,
    machineConnectionRepository as never,
    writePackageRepository as never,
  );
  return {
    machineAccessResolver,
    machineConnectionRepository,
    writePackageRepository,
    unitOfWork,
    access,
  };
}
