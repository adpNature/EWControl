/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/05-auth-login.md: arranca `AuthModule` real contra el Postgres de
 * `docker compose`, sin pasar por HTTP (igual que `seed-demo-environment` y
 * `seed-history`). Cubre los criterios de aceptación backend 1-8 de la spec.
 */
import { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AuthModule } from '../src/frameworks-drivers/auth.module';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { AuthAuditEventType } from '../src/entities/auth-audit-event-type.enum';
import { RefreshTokenStatus } from '../src/entities/refresh-token-status.enum';
import { InvalidCredentialsError } from '../src/use-cases/auth/errors/invalid-credentials.error';
import { InvalidResetTokenError } from '../src/use-cases/auth/errors/invalid-reset-token.error';
import { RefreshTokenReusedError } from '../src/use-cases/auth/errors/refresh-token-reused.error';
import { TooManyLoginAttemptsError } from '../src/use-cases/auth/errors/too-many-login-attempts.error';
import { TooManyPasswordResetRequestsError } from '../src/use-cases/auth/errors/too-many-password-reset-requests.error';
import { ForgotPasswordUseCase } from '../src/use-cases/auth/forgot-password.use-case';
import { ResetPasswordUseCase } from '../src/use-cases/auth/reset-password.use-case';
import { type IClock, CLOCK } from '../src/use-cases/history/ports/clock.port';
import { LoginUseCase } from '../src/use-cases/auth/login.use-case';
import { LogoutUseCase } from '../src/use-cases/auth/logout.use-case';
import { RefreshUseCase } from '../src/use-cases/auth/refresh.use-case';
import { type ITokenService, TOKEN_SERVICE } from '../src/use-cases/auth/ports/token.port';
import {
  type IPasswordHasher,
  PASSWORD_HASHER,
} from '../src/use-cases/seed-demo-environment/ports/password-hasher.port';
import {
  SEED_USER_EMAIL as DEMO_EMAIL,
  SEED_USER_PASSWORD as DEMO_PASSWORD,
} from '../src/use-cases/seed-demo-environment/seed-demo-environment.config';

async function truncateAuthTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "auth_audit_log", "refresh_tokens", "password_reset_tokens", "signals", "machine_connections", "machines", "users", "companies" RESTART IDENTITY CASCADE',
  );
}

async function insertCompany(dataSource: DataSource, isActive = true): Promise<string> {
  const [row] = await dataSource.query(
    'INSERT INTO companies (name, is_active) VALUES ($1, $2) RETURNING id',
    ['Empresa Demo', isActive],
  );
  return row.id;
}

async function insertUser(
  dataSource: DataSource,
  passwordHasher: IPasswordHasher,
  options: { companyId: string; email?: string; password?: string; isActive?: boolean },
): Promise<string> {
  const passwordHash = await passwordHasher.hash(options.password ?? DEMO_PASSWORD);
  const [row] = await dataSource.query(
    'INSERT INTO users (company_id, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [
      options.companyId,
      options.email ?? DEMO_EMAIL,
      passwordHash,
      'AdminCliente',
      options.isActive ?? true,
    ],
  );
  return row.id;
}

async function findRefreshTokenRow(
  dataSource: DataSource,
  jti: string,
): Promise<{ status: string } | undefined> {
  const rows = await dataSource.query('SELECT status FROM refresh_tokens WHERE id = $1', [jti]);
  return rows[0];
}

describe('Auth (login/refresh/logout) (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let passwordHasher: IPasswordHasher;
  let tokenService: ITokenService;
  let loginUseCase: LoginUseCase;
  let refreshUseCase: RefreshUseCase;
  let logoutUseCase: LogoutUseCase;
  let forgotPasswordUseCase: ForgotPasswordUseCase;
  let resetPasswordUseCase: ResetPasswordUseCase;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, AuthModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
    passwordHasher = app.get(PASSWORD_HASHER);
    tokenService = app.get(TOKEN_SERVICE);
    loginUseCase = app.get(LoginUseCase);
    refreshUseCase = app.get(RefreshUseCase);
    logoutUseCase = app.get(LogoutUseCase);
    forgotPasswordUseCase = app.get(ForgotPasswordUseCase);
    resetPasswordUseCase = app.get(ResetPasswordUseCase);
  });

  beforeEach(async () => {
    await truncateAuthTables(dataSource);
  });

  afterAll(async () => {
    await truncateAuthTables(dataSource);
    await app.close();
  });

  it('con credenciales correctas devuelve tokens válidos, persiste el refresh token y audita el éxito (criterios 1, 8)', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId });

    const session = await loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD });

    const accessPayload = await tokenService.verifyAccessToken(session.accessToken);
    expect(accessPayload.email).toBe(DEMO_EMAIL);
    const refreshPayload = await tokenService.verifyRefreshToken(session.refreshToken);
    expect(refreshPayload.sub).toBe(session.user.id);

    const tokenRow = await findRefreshTokenRow(dataSource, refreshPayload.jti);
    expect(tokenRow?.status).toBe(RefreshTokenStatus.Active);

    const [audit] = await dataSource.query(
      'SELECT event_type FROM auth_audit_log WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [DEMO_EMAIL],
    );
    expect(audit.event_type).toBe(AuthAuditEventType.LoginSuccess);

    const [user] = await dataSource.query('SELECT password_hash FROM users WHERE email = $1', [
      DEMO_EMAIL,
    ]);
    expect(user.password_hash).not.toBe(DEMO_PASSWORD);
    expect(user.password_hash).toMatch(/^\$2/);
  });

  it('con password incorrecta lanza InvalidCredentialsError y audita el fallo, sin crear refresh token (criterio 2)', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId });

    await expect(
      loginUseCase.execute({ email: DEMO_EMAIL, password: 'incorrecta' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    expect(await dataSource.query('SELECT COUNT(*)::int AS c FROM refresh_tokens')).toEqual([
      { c: 0 },
    ]);
    const [audit] = await dataSource.query(
      'SELECT event_type FROM auth_audit_log WHERE email = $1',
      [DEMO_EMAIL],
    );
    expect(audit.event_type).toBe(AuthAuditEventType.LoginFailure);
  });

  it('con un email inexistente lanza el mismo InvalidCredentialsError que una password incorrecta (criterio 2)', async () => {
    await expect(
      loginUseCase.execute({ email: 'ghost@ewcontrol.local', password: 'lo-que-sea' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rota el refresh token en cada uso: el anterior queda rotado, se emite uno nuevo activo (criterio 3)', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId });
    const first = await loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    const firstPayload = await tokenService.verifyRefreshToken(first.refreshToken);

    const second = await refreshUseCase.execute({ refreshToken: first.refreshToken });
    const secondPayload = await tokenService.verifyRefreshToken(second.refreshToken);

    expect(secondPayload.jti).not.toBe(firstPayload.jti);
    expect((await findRefreshTokenRow(dataSource, firstPayload.jti))?.status).toBe(
      RefreshTokenStatus.Rotated,
    );
    expect((await findRefreshTokenRow(dataSource, secondPayload.jti))?.status).toBe(
      RefreshTokenStatus.Active,
    );
  });

  it('reutilizar un refresh token ya rotado invalida TODAS las sesiones del usuario (criterio 4)', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId });
    const first = await loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    const second = await refreshUseCase.execute({ refreshToken: first.refreshToken });
    const secondPayload = await tokenService.verifyRefreshToken(second.refreshToken);

    // Reusar el primer refresh token (ya rotado por el paso anterior).
    await expect(
      refreshUseCase.execute({ refreshToken: first.refreshToken }),
    ).rejects.toBeInstanceOf(RefreshTokenReusedError);

    expect((await findRefreshTokenRow(dataSource, secondPayload.jti))?.status).toBe(
      RefreshTokenStatus.Revoked,
    );
    const [audit] = await dataSource.query(
      "SELECT event_type FROM auth_audit_log WHERE event_type = 'REFRESH_REUSE_DETECTED'",
    );
    expect(audit.event_type).toBe(AuthAuditEventType.RefreshReuseDetected);

    // El "más reciente" (emitido en la rotación) también queda invalidado.
    await expect(
      refreshUseCase.execute({ refreshToken: second.refreshToken }),
    ).rejects.toBeInstanceOf(RefreshTokenReusedError);
  });

  it('desactivar el User invalida el login (criterio 6)', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId, isActive: false });

    await expect(
      loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('desactivar la Company invalida el login de sus Users (criterio 6)', async () => {
    const companyId = await insertCompany(dataSource, false);
    await insertUser(dataSource, passwordHasher, { companyId });

    await expect(
      loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('desactivar el User tras emitir un refresh token también invalida el refresh (criterio 6)', async () => {
    const companyId = await insertCompany(dataSource);
    const userId = await insertUser(dataSource, passwordHasher, { companyId });
    const session = await loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD });

    await dataSource.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);

    await expect(
      refreshUseCase.execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('bloquea tras 5 fallos en 15 min y desbloquea fuera de esa ventana (criterio 7)', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId });

    class FakeClock implements IClock {
      current = new Date('2026-07-09T12:00:00.000Z');
      now(): Date {
        return this.current;
      }
    }
    const fakeClock = new FakeClock();
    const moduleRef = await Test.createTestingModule({ imports: [SeedModule, AuthModule] })
      .overrideProvider(CLOCK)
      .useValue(fakeClock)
      .compile();
    const overriddenApp = moduleRef.createNestApplication();
    await overriddenApp.init();
    const overriddenLogin = overriddenApp.get(LoginUseCase);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        overriddenLogin.execute({ email: DEMO_EMAIL, password: 'incorrecta' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }

    await expect(
      overriddenLogin.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    ).rejects.toBeInstanceOf(TooManyLoginAttemptsError);

    fakeClock.current = new Date(fakeClock.current.getTime() + 16 * 60 * 1000);

    const session = await overriddenLogin.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(session.accessToken).toBeTruthy();

    await overriddenApp.close();
  });

  it('logout revoca el refresh token actual; reusarlo después falla (criterio 5)', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId });
    const session = await loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD });

    await logoutUseCase.execute({ refreshToken: session.refreshToken });

    const payload = await tokenService.verifyRefreshToken(session.refreshToken);
    expect((await findRefreshTokenRow(dataSource, payload.jti))?.status).toBe(
      RefreshTokenStatus.Revoked,
    );

    // Un token revocado se trata igual que uno reutilizado (docs/specs/05-auth-login.md, criterio 4).
    await expect(
      refreshUseCase.execute({ refreshToken: session.refreshToken }),
    ).rejects.toBeInstanceOf(RefreshTokenReusedError);
  });

  it('logout sin refresh token es idempotente y no lanza', async () => {
    await expect(logoutUseCase.execute({ refreshToken: undefined })).resolves.toBeUndefined();
  });

  it('forgot-password + reset-password: genera un token real, permite fijar una nueva contraseña y revoca las sesiones activas (docs/specs/10)', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId });
    const session = await loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD });

    await forgotPasswordUseCase.execute({ email: DEMO_EMAIL });

    const [tokenRow] = await dataSource.query(
      'SELECT id FROM password_reset_tokens ORDER BY created_at DESC LIMIT 1',
    );
    expect(tokenRow?.id).toBeTruthy();

    await resetPasswordUseCase.execute({ token: tokenRow.id, newPassword: 'NuevaPass1234!' });

    await expect(
      loginUseCase.execute({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    const newSession = await loginUseCase.execute({
      email: DEMO_EMAIL,
      password: 'NuevaPass1234!',
    });
    expect(newSession.accessToken).toBeTruthy();

    const oldRefreshPayload = await tokenService.verifyRefreshToken(session.refreshToken);
    expect((await findRefreshTokenRow(dataSource, oldRefreshPayload.jti))?.status).toBe(
      RefreshTokenStatus.Revoked,
    );

    await expect(
      resetPasswordUseCase.execute({ token: tokenRow.id, newPassword: 'OtraVez1234!' }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });

  it('forgot-password no crea ningún token para un email inexistente, sin lanzar (evita enumeración)', async () => {
    await expect(
      forgotPasswordUseCase.execute({ email: 'ghost@ewcontrol.local' }),
    ).resolves.toBeUndefined();

    expect(await dataSource.query('SELECT COUNT(*)::int AS c FROM password_reset_tokens')).toEqual([
      { c: 0 },
    ]);
  });

  it('forgot-password bloquea tras 3 solicitudes en 15 minutos para el mismo email', async () => {
    const companyId = await insertCompany(dataSource);
    await insertUser(dataSource, passwordHasher, { companyId });

    await forgotPasswordUseCase.execute({ email: DEMO_EMAIL });
    await forgotPasswordUseCase.execute({ email: DEMO_EMAIL });
    await forgotPasswordUseCase.execute({ email: DEMO_EMAIL });

    await expect(forgotPasswordUseCase.execute({ email: DEMO_EMAIL })).rejects.toBeInstanceOf(
      TooManyPasswordResetRequestsError,
    );
  });

  it('reset-password con un token inexistente responde InvalidResetTokenError', async () => {
    await expect(
      resetPasswordUseCase.execute({
        token: '00000000-0000-0000-0000-000000000000',
        newPassword: 'NuevaPass1234!',
      }),
    ).rejects.toBeInstanceOf(InvalidResetTokenError);
  });
});
