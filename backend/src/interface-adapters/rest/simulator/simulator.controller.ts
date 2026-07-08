import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MachineNotFoundError } from '../../../use-cases/simulator-control/errors/machine-not-found.error';
import { NotASimulatedMachineError } from '../../../use-cases/simulator-control/errors/not-a-simulated-machine.error';
import { SignalNotFoundError } from '../../../use-cases/simulator-control/errors/signal-not-found.error';
import { ForceDisconnectSimulatorUseCase } from '../../../use-cases/simulator-control/force-disconnect-simulator.use-case';
import { ForceSignalQualityUseCase } from '../../../use-cases/simulator-control/force-signal-quality.use-case';
import { ReconnectSimulatorUseCase } from '../../../use-cases/simulator-control/reconnect-simulator.use-case';
import { ForceQualityDto } from './force-quality.dto';

/**
 * Endpoints de control del Simulador (docs/specs/03-simulador-forzar-fallo.md,
 * docs/11-api-rest.md). NOTA: sin protección JWT/rol/Company todavía — la spec
 * 05-auth-login.md registrará el Auth Guard como interceptor global (Documento 2,
 * "Auth Guard"), que protegerá automáticamente estos endpoints sin cambios aquí.
 */
@Controller('machines/:machineId/simulator')
export class SimulatorController {
  constructor(
    private readonly forceDisconnectUseCase: ForceDisconnectSimulatorUseCase,
    private readonly reconnectUseCase: ReconnectSimulatorUseCase,
    private readonly forceSignalQualityUseCase: ForceSignalQualityUseCase,
  ) {}

  @Post('force-disconnect')
  @HttpCode(HttpStatus.OK)
  async forceDisconnect(@Param('machineId') machineId: string): Promise<{ machineId: string }> {
    try {
      await this.forceDisconnectUseCase.execute(machineId);
    } catch (error) {
      throw this.toHttpException(error);
    }
    return { machineId };
  }

  @Post('reconnect')
  @HttpCode(HttpStatus.OK)
  async reconnect(@Param('machineId') machineId: string): Promise<{ machineId: string }> {
    try {
      await this.reconnectUseCase.execute(machineId);
    } catch (error) {
      throw this.toHttpException(error);
    }
    return { machineId };
  }

  @Post('force-quality')
  @HttpCode(HttpStatus.OK)
  async forceQuality(
    @Param('machineId') machineId: string,
    @Body() dto: ForceQualityDto,
  ): Promise<{ machineId: string } & ForceQualityDto> {
    try {
      await this.forceSignalQualityUseCase.execute({ machineId, ...dto });
    } catch (error) {
      throw this.toHttpException(error);
    }
    return { machineId, ...dto };
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof MachineNotFoundError) {
      return new NotFoundException({ code: 'MACHINE_NOT_FOUND', message: error.message });
    }
    if (error instanceof SignalNotFoundError) {
      return new NotFoundException({ code: 'SIGNAL_NOT_FOUND', message: error.message });
    }
    if (error instanceof NotASimulatedMachineError) {
      return new UnprocessableEntityException({
        code: 'NOT_A_SIMULATED_MACHINE',
        message: error.message,
      });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
