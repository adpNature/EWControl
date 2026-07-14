import { AlarmDefinition } from './alarm-definition.entity';
import { AlarmState } from './alarm-state.entity';
import { AuthAuditLog } from './auth-audit-log.entity';
import { Company } from './company.entity';
import { Dashboard } from './dashboard.entity';
import { DashboardWidget } from './dashboard-widget.entity';
import { MachineConnection } from './machine-connection.entity';
import { Machine } from './machine.entity';
import { PasswordResetToken } from './password-reset-token.entity';
import { RefreshToken } from './refresh-token.entity';
import { Signal } from './signal.entity';
import { User } from './user.entity';

/**
 * Lista explícita de entidades TypeORM para `TypeOrmModule.forRoot()`
 * (app.module.ts, seed.module.ts). No se usa un glob de archivos porque
 * `TypeOrmModule` requiere en tiempo de ejecución cada `.entity.ts` por ruta
 * de archivo, lo que falla fuera de un runtime con `ts-node` registrado
 * (por ejemplo, bajo Vitest en los tests e2e). El CLI de migraciones
 * (postgres.datasource.ts) sí puede usar un glob porque `typeorm-ts-node-commonjs`
 * registra `ts-node` antes de ejecutarse.
 */
export const ENTITIES = [
  Company,
  User,
  Machine,
  MachineConnection,
  Signal,
  RefreshToken,
  PasswordResetToken,
  AuthAuditLog,
  Dashboard,
  DashboardWidget,
  AlarmDefinition,
  AlarmState,
];
