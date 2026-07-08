import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SeedModule } from './frameworks-drivers/seed.module';
import { MigrationsNotAppliedError } from './use-cases/seed-demo-environment/errors/migrations-not-applied.error';
import { SeedDemoEnvironmentUseCase } from './use-cases/seed-demo-environment/seed-demo-environment.use-case';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn'] });

  try {
    const useCase = app.get(SeedDemoEnvironmentUseCase);
    const { created } = await useCase.execute();
    console.log(
      created ? 'Entorno demo creado.' : 'El entorno demo ya existía; no se ha duplicado nada.',
    );
  } catch (error) {
    if (error instanceof MigrationsNotAppliedError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await app.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
