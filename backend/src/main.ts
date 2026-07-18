import 'reflect-metadata';
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './frameworks-drivers/app.module';
import { HttpExceptionFilter } from './interface-adapters/rest/http-exception.filter';
import { PrometheusMetricsService } from './interface-adapters/observability/prometheus-metrics.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  // Expone el correlationId de la petición (docs/07-observabilidad-monitorizacion.md,
  // apartado 7.2, spec 15). Se genera aquí y se asigna a `req.id` en vez de
  // leerlo: los middlewares registrados vía `configure()` de un módulo (como el
  // de `pino-http` de `LoggerModule`) se enlazan a Express en `app.listen()`,
  // después de los `app.use()` directos de este archivo — leer `req.id` aquí
  // sería `undefined` y `res.setHeader(..., undefined)` lanzaría. Al asignarlo
  // nosotros, `pino-http` lo reutiliza (`req.id = req.id || genReqId(...)`),
  // quedando el mismo id en el header y en los logs.
  app.use((req: Request & { id?: string }, res: Response, next: NextFunction) => {
    req.id = req.id ?? randomUUID();
    res.setHeader('X-Correlation-Id', req.id);
    next();
  });
  // Métricas HTTP (docs/07-observabilidad-monitorizacion.md, apartado 7.3, spec
  // 15): `req.route` solo está poblado tras el enrutado, por eso se lee dentro
  // del handler de `finish`, no al entrar la petición.
  const metrics = app.get(PrometheusMetricsService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      const route = req.route ? `${req.baseUrl}${req.route.path}` : req.path;
      metrics.observeHttpRequest(req.method, route, res.statusCode, durationSeconds);
    });
    next();
  });
  app.setGlobalPrefix('api/v1', { exclude: ['health/(.*)', 'metrics'] }); // docs/11-api-rest.md, docs/specs/15-observabilidad-tecnica.md
  app.useWebSocketAdapter(new IoAdapter(app)); // docs/specs/07-dashboard-tiempo-real.md

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
