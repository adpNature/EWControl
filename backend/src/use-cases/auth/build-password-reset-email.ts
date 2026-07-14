export type BuildPasswordResetEmailInput = { resetUrl: string };
export type PasswordResetEmailContent = { subject: string; text: string };

/**
 * Contenido del email de recuperación de contraseña (docs/specs/10-gestion-companies-users.md),
 * mismo patrón que `build-alarm-email.ts`.
 */
export function buildPasswordResetEmail(
  input: BuildPasswordResetEmailInput,
): PasswordResetEmailContent {
  return {
    subject: 'Recuperación de contraseña — EWControl',
    text: [
      'Has solicitado recuperar tu contraseña en EWControl.',
      `Sigue este enlace para establecer una nueva contraseña (válido durante 1 hora): ${input.resetUrl}`,
      'Si no has solicitado este cambio, ignora este email.',
    ].join('\n'),
  };
}
