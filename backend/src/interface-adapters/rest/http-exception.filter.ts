import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';

const HTTP_STATUS_CODE_NAMES = new Map<number, string>([
  [400, 'BAD_REQUEST'],
  [401, 'UNAUTHORIZED'],
  [403, 'FORBIDDEN'],
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
  [422, 'UNPROCESSABLE_ENTITY'],
  [500, 'INTERNAL_ERROR'],
  [503, 'SERVICE_UNAVAILABLE'],
]);

type NormalizedError = { code: string; message: string; details?: unknown };

/**
 * Normaliza cualquier excepción al formato uniforme `{code, message, details}`
 * exigido por docs/11-api-rest.md ("Errores"). Reutilizable por cualquier
 * controller de cualquier spec futura con REST, no específico de una sola.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(this.normalize(exception.getResponse(), status));
      return;
    }

    response.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }

  private normalize(body: string | object, status: number): NormalizedError {
    if (typeof body === 'object' && body !== null && 'code' in body) {
      const { code, message, details } = body as NormalizedError;
      return { code, message, details };
    }

    const rawMessage =
      typeof body === 'object' && body !== null && 'message' in body
        ? (body as { message: string | string[] }).message
        : String(body);

    return {
      code: HTTP_STATUS_CODE_NAMES.get(status) ?? 'ERROR',
      message: Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage,
      details: typeof body === 'object' ? body : undefined,
    };
  }
}
