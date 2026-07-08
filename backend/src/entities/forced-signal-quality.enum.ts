/**
 * Calidad que se puede forzar sobre una Signal simulada (spec 03-simulador-forzar-fallo).
 * Subconjunto de `DataQuality` (Interface Adapters): el dominio nunca conoce ese
 * enum de infraestructura, solo los dos valores que tiene sentido forzar manualmente.
 */
export enum ForcedSignalQuality {
  Bad = 'BAD',
  Uncertain = 'UNCERTAIN',
}
