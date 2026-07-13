/**
 * Opciones de conexión SMTP, consumidas por el Email Adapter del Notification
 * Service (docs/specs/09-alarmas.md; Documento 2, apartado 2.10), mismo
 * patrón que `influxdb.config.ts` para centralizar la lectura de variables de entorno.
 */
export function smtpConnectionOptions(): {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
} {
  return {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    from: process.env.SMTP_FROM ?? 'alerts@ewcontrol.local',
  };
}
