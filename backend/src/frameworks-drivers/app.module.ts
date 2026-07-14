import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { ENTITIES } from '../entities';
import { AlarmsModule } from './alarms.module';
import { AuthModule } from './auth.module';
import { CompanyManagementModule } from './company-management.module';
import { DashboardModule } from './dashboard.module';
import { MachineManagementModule } from './machine-management.module';
import { SimulatorModule } from './simulator.module';
import { postgresConnectionOptions } from './database/postgres.config';

/**
 * Módulo raíz. Registra el arranque de los motores externos (PostgreSQL, logging);
 * los módulos de features (Dashboard, Alarmas...) se añaden aquí a medida que
 * se implementan sus specs (docs/specs/), no por adelantado.
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...postgresConnectionOptions(),
      entities: ENTITIES,
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    SimulatorModule,
    CompanyManagementModule,
    MachineManagementModule,
    DashboardModule,
    AlarmsModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.refreshToken',
            'req.body.accessToken',
          ],
          censor: '[REDACTED]',
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
  ],
})
export class AppModule {}
