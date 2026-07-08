import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/**/*.integration-spec.ts'],
      // Levantar la app Nest completa (+ conexión a Postgres) tarda más que un unit test.
      hookTimeout: 30000,
    },
  }),
);
