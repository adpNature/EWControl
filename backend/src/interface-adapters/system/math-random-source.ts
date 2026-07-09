import { Injectable } from '@nestjs/common';
import { IRandomSource } from '../../use-cases/history/ports/random-source.port';

@Injectable()
export class MathRandomSource implements IRandomSource {
  next(): number {
    return Math.random();
  }
}
