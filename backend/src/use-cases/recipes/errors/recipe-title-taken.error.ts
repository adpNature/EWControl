/** docs/specs/25-recetas.md: el título es único por Machine sin distinguir mayúsculas ni tildes. */
export class RecipeTitleTakenError extends Error {
  constructor(title: string) {
    super(`Ya existe una receta llamada "${title}" en esta Machine.`);
    this.name = 'RecipeTitleTakenError';
  }
}
