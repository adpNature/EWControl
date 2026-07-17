import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { CurrentUser } from '../../auth-guard/current-user';
import { currentUser } from '../../auth-guard/current-user.decorator';
import { CompanyIdRequiredError } from '../../../use-cases/history/errors/company-id-required.error';
import { InvalidHistoryRangeError } from '../../../use-cases/history/errors/invalid-history-range.error';
import { SignalNotFoundForHistoryError } from '../../../use-cases/history/errors/signal-not-found-for-history.error';
import {
  GetSignalsHistoryResult,
  GetSignalsHistoryUseCase,
} from '../../../use-cases/history/get-signals-history.use-case';
import { HistoryComparisonQueryDto } from './history-comparison-query.dto';

/** docs/specs/14-historicos-comparativas.md: comparativa de histórico multi-Signal/Machine. */
@Controller('signals')
export class SignalsHistoryController {
  constructor(private readonly getSignalsHistoryUseCase: GetSignalsHistoryUseCase) {}

  @Get('history')
  async getHistory(
    @Query() query: HistoryComparisonQueryDto,
    @currentUser() user: CurrentUser,
  ): Promise<GetSignalsHistoryResult> {
    try {
      return await this.getSignalsHistoryUseCase.execute({
        signalIds: query.signalIds,
        from: new Date(query.from),
        to: new Date(query.to),
        resolution: query.resolution,
        companyId: query.companyId,
        requester: { companyId: user.companyId, role: user.role },
      });
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof InvalidHistoryRangeError) {
      return new BadRequestException({ code: 'INVALID_RANGE', message: error.message });
    }
    if (error instanceof CompanyIdRequiredError) {
      return new BadRequestException({ code: 'COMPANY_ID_REQUIRED', message: error.message });
    }
    if (error instanceof SignalNotFoundForHistoryError) {
      return new UnprocessableEntityException({
        code: 'SIGNAL_NOT_FOUND_FOR_HISTORY',
        message: error.message,
        details: { signalIds: error.signalIds },
      });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
