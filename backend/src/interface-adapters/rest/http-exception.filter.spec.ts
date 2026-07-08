import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

function createHost() {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('HttpExceptionFilter', () => {
  it('normaliza una HttpException con {code, message} propio sin cambios', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();
    const exception = new HttpException(
      { code: 'NOT_A_SIMULATED_MACHINE', message: 'no es simulator' },
      422,
    );

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith({
      code: 'NOT_A_SIMULATED_MACHINE',
      message: 'no es simulator',
      details: undefined,
    });
  });

  it('normaliza el BadRequestException estándar del ValidationPipe', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();
    const exception = new BadRequestException(['durationTicks must be a positive number']);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(400);
    const [payload] = response.json.mock.calls[0];
    expect(payload.code).toBe('BAD_REQUEST');
    expect(payload.message).toContain('durationTicks must be a positive number');
  });

  it('normaliza un NotFoundException con body string', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();
    const exception = new NotFoundException('No existe la Machine');

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(404);
    const [payload] = response.json.mock.calls[0];
    expect(payload.code).toBe('NOT_FOUND');
    expect(payload.message).toBe('No existe la Machine');
  });

  it('devuelve 500 INTERNAL_ERROR para un error no controlado', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(new Error('boom'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
  });
});
