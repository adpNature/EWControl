import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from '../vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/**/*.integration-spec.ts'],
      // Levantar la app Nest completa (+ conexión a Postgres) tarda más que un unit test.
      hookTimeout: 30000,
      // Todos los specs de integración comparten el mismo Postgres real y aíslan
      // cada test truncando tablas comunes (companies/users/...); en paralelo, un
      // archivo puede truncar mientras otro tiene una fila a medio insertar
      // (deadlocks, violaciones de FK/unicidad intermitentes). Sin coste real: son
      // pocos archivos y ya son la capa más lenta de la pirámide de testing.
      fileParallelism: false,
    },
  }),
);
