/**
 * Calidad de una Signal en la Realtime Cache (Documento 2, apartado 2.6).
 * Independiente de `DataQuality` (Data Provider, capa Interface Adapters):
 * entities no puede depender de una capa más externa, aunque los valores coincidan.
 */
export enum SignalQuality {
  Good = 'GOOD',
  Bad = 'BAD',
  Uncertain = 'UNCERTAIN',
  Offline = 'OFFLINE',
}
