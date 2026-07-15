/**
 * docs/specs/10-gestion-companies-users.md, criterio de aceptación backend 11:
 * mínimo 8 caracteres, al menos una letra y un número. Compartido por los DTOs
 * de creación de User, cambio de contraseña propio y recuperación de contraseña.
 */
export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_POLICY_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres, incluyendo una letra y un número.';
