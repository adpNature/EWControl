export class WriteTimeoutError extends Error {
  constructor() {
    super('El servidor OPC UA no respondió a la escritura a tiempo.');
    this.name = 'WriteTimeoutError';
  }
}
