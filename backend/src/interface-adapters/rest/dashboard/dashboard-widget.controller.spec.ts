import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../../entities/user-role.enum';
import { WidgetType } from '../../../entities/widget-type.enum';
import { CreateWidgetUseCase } from '../../../use-cases/dashboard/create-widget.use-case';
import { DeleteWidgetUseCase } from '../../../use-cases/dashboard/delete-widget.use-case';
import { SignalNotFoundForWidgetError } from '../../../use-cases/dashboard/errors/signal-not-found-for-widget.error';
import { WidgetNotFoundError } from '../../../use-cases/dashboard/errors/widget-not-found.error';
import { UpdateWidgetUseCase } from '../../../use-cases/dashboard/update-widget.use-case';
import { HttpExceptionFilter } from '../http-exception.filter';
import { DashboardWidgetController } from './dashboard-widget.controller';

const FAKE_USER = {
  id: 'user-1',
  email: 'demo@ewcontrol.local',
  companyId: 'company-1',
  role: UserRole.AdminCliente,
};

describe('DashboardWidgetController (HTTP)', () => {
  let app: INestApplication;
  let createWidgetUseCase: { execute: ReturnType<typeof vi.fn> };
  let updateWidgetUseCase: { execute: ReturnType<typeof vi.fn> };
  let deleteWidgetUseCase: { execute: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    createWidgetUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'widget-1', widgetType: WidgetType.Value }),
    };
    updateWidgetUseCase = {
      execute: vi.fn().mockResolvedValue({ id: 'widget-1', position: 2 }),
    };
    deleteWidgetUseCase = { execute: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardWidgetController],
      providers: [
        { provide: CreateWidgetUseCase, useValue: createWidgetUseCase },
        { provide: UpdateWidgetUseCase, useValue: updateWidgetUseCase },
        { provide: DeleteWidgetUseCase, useValue: deleteWidgetUseCase },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user: unknown }, _res: unknown, next: () => void) => {
      req.user = FAKE_USER;
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST / crea un widget VALUE', async () => {
    const response = await request(app.getHttpServer())
      .post('/dashboards/dashboard-1/widgets')
      .send({ widgetType: 'VALUE', signalIds: ['signal-1'], config: {} });

    expect(response.status).toBe(201);
    expect(createWidgetUseCase.execute).toHaveBeenCalledWith({
      dashboardId: 'dashboard-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
      widgetType: WidgetType.Value,
      widgetConfig: {},
      signalIds: ['signal-1'],
      position: undefined,
    });
  });

  it('POST / crea un widget GAUGE válido', async () => {
    const response = await request(app.getHttpServer())
      .post('/dashboards/dashboard-1/widgets')
      .send({ widgetType: 'GAUGE', signalIds: ['signal-1'], config: { min: 0, max: 100 } });

    expect(response.status).toBe(201);
  });

  it('POST / responde 400 si GAUGE trae min >= max', async () => {
    const response = await request(app.getHttpServer())
      .post('/dashboards/dashboard-1/widgets')
      .send({ widgetType: 'GAUGE', signalIds: ['signal-1'], config: { min: 100, max: 0 } });

    expect(response.status).toBe(400);
    expect(createWidgetUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST / responde 422 SIGNAL_NOT_FOUND_FOR_WIDGET si el use-case lo lanza', async () => {
    createWidgetUseCase.execute.mockRejectedValue(new SignalNotFoundForWidgetError(['signal-1']));

    const response = await request(app.getHttpServer())
      .post('/dashboards/dashboard-1/widgets')
      .send({ widgetType: 'VALUE', signalIds: ['signal-1'], config: {} });

    expect(response.status).toBe(422);
    expect(response.body.code).toBe('SIGNAL_NOT_FOUND_FOR_WIDGET');
    expect(response.body.details).toEqual({ signalIds: ['signal-1'] });
  });

  it('PATCH /:widgetId responde 400 si config trae min >= max', async () => {
    const response = await request(app.getHttpServer())
      .patch('/dashboards/dashboard-1/widgets/widget-1')
      .send({ config: { min: 100, max: 0 } });

    expect(response.status).toBe(400);
    expect(updateWidgetUseCase.execute).not.toHaveBeenCalled();
  });

  it('PATCH /:widgetId responde 404 WIDGET_NOT_FOUND si el use-case lo lanza', async () => {
    updateWidgetUseCase.execute.mockRejectedValue(new WidgetNotFoundError('widget-1'));

    const response = await request(app.getHttpServer())
      .patch('/dashboards/dashboard-1/widgets/widget-1')
      .send({ position: 2 });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('WIDGET_NOT_FOUND');
  });

  it('DELETE /:widgetId responde 204 en el caso feliz', async () => {
    const response = await request(app.getHttpServer()).delete(
      '/dashboards/dashboard-1/widgets/widget-1',
    );

    expect(response.status).toBe(204);
    expect(deleteWidgetUseCase.execute).toHaveBeenCalledWith({
      dashboardId: 'dashboard-1',
      widgetId: 'widget-1',
      requester: { companyId: 'company-1', role: UserRole.AdminCliente },
    });
  });
});
