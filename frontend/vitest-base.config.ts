import { defineConfig } from 'vitest/config';

/**
 * `@angular/build:unit-test` corre con `isolate: false` por defecto ("para
 * alinearse con la experiencia Karma/Jasmine"), es decir, todos los specs que
 * comparten un worker comparten también el mismo registro de módulos —
 * incluido el estado interno de `@angular/core` (grafo de signals, scheduler
 * de efectos). Con pocos workers (p. ej. los runners de GitHub Actions, 4
 * vCPUs) muchos más ficheros de test acaban empaquetados en el mismo worker
 * que en una máquina con más núcleos, y ese estado compartido puede quedar
 * corrompido entre ficheros (visto en CI: los `effect()` de
 * `RealtimeSocketService` dejaban de dispararse tras la primera ejecución
 * cuando el fichero corría junto a los demás specs, pero pasaba siempre en
 * aislamiento). `isolate: true` fuerza un registro de módulos nuevo por
 * fichero, igual que el resto del ecosistema Vitest por defecto.
 */
export default defineConfig({
  test: {
    isolate: true,
  },
});
