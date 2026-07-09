import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IIdGenerator } from '../../use-cases/auth/ports/id-generator.port';

@Injectable()
export class CryptoIdGenerator implements IIdGenerator {
  generate(): string {
    return randomUUID();
  }
}
