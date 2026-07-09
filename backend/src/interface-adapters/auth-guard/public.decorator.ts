import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Excluye un endpoint del `JwtAuthGuard` global (docs/specs/05-auth-login.md).
 * camelCase (no `Public`/`PascalCase`, aunque sea la convención habitual de
 * decorador en NestJS) para cumplir la regla de naming de este proyecto
 * (`@typescript-eslint/naming-convention`, docs/00-metodologia-y-calidad.md).
 */
export const publicRoute = () => SetMetadata(IS_PUBLIC_KEY, true);
