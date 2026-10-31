export class WritePackageNameTakenError extends Error {
  constructor(name: string) {
    super(`Ya existe un paquete llamado "${name}" en esta Machine.`);
    this.name = 'WritePackageNameTakenError';
  }
}
