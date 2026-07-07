import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

// unplugin-swc es imprescindible: esbuild (motor por defecto de Vitest) no soporta
// emitDecoratorMetadata y rompe silenciosamente la inyección de dependencias de NestJS.
export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    pool: 'forks',
    // Documento 0, Fase 1: Frameworks & Drivers no tiene specs propias hasta la primera feature vertical.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['node_modules/**', 'dist/**', '**/*.spec.ts', '**/*.dto.ts', '**/*.entity.ts'],
      thresholds: {
        // Documento 0, "Cobertura": 80% en Entities y Use Cases.
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
