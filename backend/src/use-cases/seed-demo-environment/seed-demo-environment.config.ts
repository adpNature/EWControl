import { ConnectionConfig } from '../../entities/connection-config.vo';
import { ProviderType } from '../../entities/provider-type.enum';
import { SignalType } from '../../entities/signal-type.enum';
import { UserRole } from '../../entities/user-role.enum';

/**
 * Datos exactos del entorno demo (spec 01-fundacion-entorno-demo.md;
 * seed profile "bobinadora-energia-v1" en docs/10-simulador-datos-demo.md §10.2/10.3).
 */
export const SEED_COMPANY_NAME = 'EWControl Demo';
export const SEED_USER_EMAIL = 'demo@ewcontrol.local';
export const SEED_USER_PASSWORD = 'Demo1234!';
export const SEED_USER_ROLE = UserRole.AdminCliente;
/** SuperAdmin de demo (docs/specs/10-gestion-companies-users.md), misma Company que el AdminCliente anterior. */
export const SEED_SUPERADMIN_EMAIL = 'superadmin@ewcontrol.local';
export const SEED_SUPERADMIN_PASSWORD = 'SuperAdmin1234!';
export const SEED_SUPERADMIN_ROLE = UserRole.SuperAdmin;
export const SEED_MACHINE_NAME = 'Bobinadora Demo 1';
export const SEED_MACHINE_PROVIDER_TYPE = ProviderType.Simulator;

export const SEED_CONNECTION_CONFIG: ConnectionConfig = {
  seedProfile: 'bobinadora-energia-v1',
  signals: [
    { variableName: 'WindingSpeed', min: 0, max: 1200, stepMax: 15 },
    { variableName: 'ThreadTension', min: 0, max: 50, stepMax: 1.5 },
    { variableName: 'MotorTemperature', min: 20, max: 90, stepMax: 0.5 },
    { variableName: 'MotorCurrent', min: 0, max: 25, stepMax: 1 },
    { variableName: 'PieceCounter', mode: 'incremental' },
    { variableName: 'RunStop', mode: 'cycle', cycleTicks: 300 },
  ],
};

export const SEED_SIGNALS: Array<{ name: string; unit: string }> = [
  { name: 'WindingSpeed', unit: 'rpm' },
  { name: 'ThreadTension', unit: 'N' },
  { name: 'MotorTemperature', unit: '°C' },
  { name: 'MotorCurrent', unit: 'A' },
  { name: 'PieceCounter', unit: 'uds' },
  { name: 'RunStop', unit: 'boolean' },
];

export const SEED_SIGNAL_TYPE = SignalType.DIRECT;
export const SEED_SIGNAL_HISTORY_ENABLED = true;
