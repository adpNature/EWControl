import { Injectable } from '@nestjs/common';
import { IClock } from '../../use-cases/history/ports/clock.port';

@Injectable()
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
