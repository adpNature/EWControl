import type { TemplateIssue } from '../../../entities/recipe-template.vo';

/** docs/specs/26-receta-base.md, criterio backend 2: lleva todos los problemas, por variable y por fila. */
export class InvalidRecipeTemplateError extends Error {
  constructor(readonly issues: TemplateIssue[]) {
    super('La receta base no es válida.');
    this.name = 'InvalidRecipeTemplateError';
  }
}
