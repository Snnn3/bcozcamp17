import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { type ApiErrorCode, createSuccessResponse } from "@bcoz/api";
import { OAuth2Client, type LoginTicket } from "google-auth-library";
import {
  effectivePermissionCodes,
  hasPermission,
  hasRole,
  type AuthenticatedPrincipal,
} from "@bcoz/auth";

export const SESSION_COOKIE_NAME = "bcoz_session";
export const CSRF_COOKIE_NAME = "bcoz_csrf";
export const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1_000;
export const OAUTH_TRANSACTION_TIMEOUT_MS = 10 * 60 * 1_000;

export interface SessionRecord {
  sessionId: string;
  csrfToken: string;
  principal: AuthenticatedPrincipal;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  absoluteExpiresAt: number;
}

export interface SessionStore {
  create(principal: AuthenticatedPrincipal, now: number): SessionRecord;
  get(sessionId: string, now: number): SessionRecord | null;
  rotate(sessionId: string, principal: AuthenticatedPrincipal, now: number): SessionRecord | null;
  revoke(sessionId: string): void;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionRecord>();

  public create(principal: AuthenticatedPrincipal, now: number): SessionRecord {
    const session: SessionRecord = {
      sessionId: randomToken(),
      csrfToken: randomToken(),
      principal,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: now + SESSION_IDLE_TIMEOUT_MS,
      absoluteExpiresAt: now + SESSION_ABSOLUTE_TIMEOUT_MS,
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  public get(sessionId: string, now: number): SessionRecord | null {
    const session = this.sessions.get(sessionId);
    if (session === undefined || session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      if (session !== undefined) {
        this.sessions.delete(sessionId);
      }
      return null;
    }

    const refreshedSession: SessionRecord = {
      ...session,
      lastSeenAt: now,
      expiresAt: Math.min(now + SESSION_IDLE_TIMEOUT_MS, session.absoluteExpiresAt),
    };
    this.sessions.set(sessionId, refreshedSession);
    return refreshedSession;
  }

  public rotate(
    sessionId: string,
    principal: AuthenticatedPrincipal,
    now: number,
  ): SessionRecord | null {
    const currentSession = this.get(sessionId, now);
    if (currentSession === null) {
      return null;
    }

    this.sessions.delete(sessionId);
    return this.create(principal, now);
  }

  public revoke(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}

export interface OAuthTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  expiresAt: number;
}

export interface OAuthTransactionStore {
  create(returnTo: string, now: number): OAuthTransaction;
  consume(state: string, now: number): OAuthTransaction | null;
}

export class InMemoryOAuthTransactionStore implements OAuthTransactionStore {
  private readonly transactions = new Map<string, OAuthTransaction>();

  public create(returnTo: string, now: number): OAuthTransaction {
    const transaction: OAuthTransaction = {
      state: randomToken(),
      nonce: randomToken(),
      codeVerifier: randomToken(),
      returnTo,
      expiresAt: now + OAUTH_TRANSACTION_TIMEOUT_MS,
    };
    this.transactions.set(transaction.state, transaction);
    return transaction;
  }

  public consume(state: string, now: number): OAuthTransaction | null {
    const transaction = this.transactions.get(state);
    this.transactions.delete(state);
    if (transaction === undefined || transaction.expiresAt <= now) {
      return null;
    }
    return transaction;
  }
}

export interface GoogleAuthorizationRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}

export interface GoogleAuthorizationCodeRequest {
  code: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface VerifiedGoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
}

export interface GoogleIdentityProvider {
  createAuthorizationUrl(request: GoogleAuthorizationRequest): string;
  exchangeAuthorizationCode(
    request: GoogleAuthorizationCodeRequest,
  ): Promise<VerifiedGoogleIdentity>;
}

export class GoogleOidcProvider implements GoogleIdentityProvider {
  private readonly client: OAuth2Client;

  public constructor(
    private readonly clientId: string,
    clientSecret: string,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.client = new OAuth2Client({ clientId, clientSecret });
  }

  public createAuthorizationUrl(request: GoogleAuthorizationRequest): string {
    return createGoogleAuthorizationUrl(request);
  }

  public async exchangeAuthorizationCode(
    request: GoogleAuthorizationCodeRequest,
  ): Promise<VerifiedGoogleIdentity> {
    const { tokens } = await this.client.getToken({
      code: request.code,
      codeVerifier: request.codeVerifier,
      redirect_uri: request.redirectUri,
    });
    const idToken = tokens.id_token;
    if (idToken === undefined || idToken === null) {
      throw new Error("Google authorization response did not contain an ID token.");
    }

    const ticket: LoginTicket = await this.client.verifyIdToken({
      idToken,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (
      payload === undefined ||
      payload.nonce !== request.nonce ||
      payload.email_verified !== true ||
      payload.sub.trim() === "" ||
      payload.email === undefined ||
      payload.email.trim() === "" ||
      !Number.isFinite(payload.exp) ||
      payload.exp * 1_000 <= this.now()
    ) {
      throw new Error("Google ID token claims were not accepted.");
    }

    return {
      subject: payload.sub,
      email: payload.email,
      emailVerified: true,
    };
  }
}

export function createGoogleOidcProvider(
  clientId: string | undefined,
  clientSecret: string | undefined,
): GoogleIdentityProvider | undefined {
  if (clientId === undefined || clientSecret === undefined) {
    return undefined;
  }
  return new GoogleOidcProvider(clientId, clientSecret);
}

export interface UserDirectory {
  resolveGoogleIdentity(identity: VerifiedGoogleIdentity): Promise<UserResolution>;
}

export type UserResolution =
  | { kind: "authenticated"; principal: AuthenticatedPrincipal }
  | { kind: "disabled" }
  | { kind: "email_collision" };

export class InMemoryUserDirectory implements UserDirectory {
  private readonly users = new Map<string, AuthenticatedPrincipal>();

  public async resolveGoogleIdentity(identity: VerifiedGoogleIdentity): Promise<UserResolution> {
    const normalizedEmail = identity.email.trim().toLowerCase();
    const existingPrincipal = this.users.get(identity.subject);
    if (existingPrincipal !== undefined) {
      if (existingPrincipal.status === "disabled") {
        return { kind: "disabled" };
      }
      if (
        [...this.users.entries()].some(
          ([subject, principal]) =>
            subject !== identity.subject && principal.email === normalizedEmail,
        )
      ) {
        return { kind: "email_collision" };
      }

      const updatedPrincipal = {
        ...existingPrincipal,
        email: normalizedEmail,
      };
      this.users.set(identity.subject, updatedPrincipal);
      return { kind: "authenticated", principal: updatedPrincipal };
    }

    if ([...this.users.values()].some((principal) => principal.email === normalizedEmail)) {
      return { kind: "email_collision" };
    }

    const principal: AuthenticatedPrincipal = {
      userId: randomToken(),
      email: normalizedEmail,
      status: "active",
      roles: ["participant"],
      permissions: [],
    };
    this.users.set(identity.subject, principal);
    return { kind: "authenticated", principal };
  }
}

export interface AuthBoundaryDependencies {
  sessionStore: SessionStore;
  transactionStore: OAuthTransactionStore;
  userDirectory: UserDirectory;
  googleProvider: GoogleIdentityProvider | undefined;
  now: () => number;
  secureCookies: boolean;
}

export interface AuthBoundaryOptions {
  sessionStore?: SessionStore;
  transactionStore?: OAuthTransactionStore;
  userDirectory?: UserDirectory;
  googleProvider?: GoogleIdentityProvider | undefined;
  now?: () => number;
  secureCookies?: boolean;
}

export function createAuthBoundaryDependencies(
  options: AuthBoundaryOptions = {},
): AuthBoundaryDependencies {
  return {
    sessionStore: options.sessionStore ?? new InMemorySessionStore(),
    transactionStore: options.transactionStore ?? new InMemoryOAuthTransactionStore(),
    userDirectory: options.userDirectory ?? new InMemoryUserDirectory(),
    googleProvider: options.googleProvider,
    now: options.now ?? (() => Date.now()),
    secureCookies: options.secureCookies ?? false,
  };
}

export interface RegisterAuthRoutesOptions {
  allowedOrigins: readonly string[];
  googleClientId?: string | undefined;
  googleRedirectUri?: string | undefined;
}

export function createGoogleAuthorizationUrl(request: GoogleAuthorizationRequest): string {
  const query = new URLSearchParams({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: request.state,
    nonce: request.nonce,
    code_challenge: request.codeChallenge,
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
}

export function registerAuthRoutes(
  server: FastifyInstance,
  dependencies: AuthBoundaryDependencies,
  options: RegisterAuthRoutesOptions,
): void {
  server.get("/api/v1/auth/session", async (request, reply) => {
    const session = getActiveSession(request, dependencies);
    if (session === null) {
      return sendApiError(reply, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }

    reply.header("cache-control", "no-store");
    return reply.send(
      createSuccessResponse({
        userId: session.principal.userId,
        email: session.principal.email,
        roles: session.principal.roles,
        permissions: effectivePermissionCodes(session.principal),
        expiresAt: new Date(session.expiresAt).toISOString(),
      }),
    );
  });

  server.post("/api/v1/auth/logout", async (request, reply) => {
    const sessionId = getCookie(request.headers.cookie, SESSION_COOKIE_NAME);
    const session =
      sessionId === undefined ? null : dependencies.sessionStore.get(sessionId, dependencies.now());

    if (session !== null && !hasValidCsrfToken(request, session.csrfToken)) {
      return sendApiError(reply, 403, "FORBIDDEN", "The request could not be verified.");
    }

    if (sessionId !== undefined) {
      dependencies.sessionStore.revoke(sessionId);
    }
    clearSessionCookies(reply, dependencies.secureCookies);
    return reply.code(204).send();
  });

  server.get("/auth/google/start", async (request, reply) => {
    const returnTo = getSafeReturnTo(
      readQueryString(request.query, "returnTo"),
      options.allowedOrigins,
    );
    if (returnTo === null) {
      return sendApiError(reply, 400, "AUTH_LOGIN_FAILED", "The login destination is not allowed.");
    }

    const clientId = options.googleClientId;
    const redirectUri = options.googleRedirectUri;
    const provider = dependencies.googleProvider;
    if (clientId === undefined || redirectUri === undefined || provider === undefined) {
      return sendApiError(
        reply,
        503,
        "AUTH_PROVIDER_UNAVAILABLE",
        "Google sign-in is temporarily unavailable.",
      );
    }

    const transaction = dependencies.transactionStore.create(returnTo, dependencies.now());
    const codeChallenge = createCodeChallenge(transaction.codeVerifier);
    const authorizationUrl = provider.createAuthorizationUrl({
      clientId,
      redirectUri,
      state: transaction.state,
      nonce: transaction.nonce,
      codeChallenge,
    });
    return reply.redirect(authorizationUrl);
  });

  server.get("/auth/google/callback", async (request, reply) => {
    const state = readQueryString(request.query, "state");
    const code = readQueryString(request.query, "code");
    const providerError = readQueryString(request.query, "error");
    const transaction =
      state === undefined ? null : dependencies.transactionStore.consume(state, dependencies.now());

    if (state === undefined || transaction === null) {
      return sendApiError(
        reply,
        400,
        "AUTH_LOGIN_FAILED",
        "Google sign-in could not be completed.",
      );
    }
    if (providerError === "access_denied") {
      return sendApiError(reply, 400, "AUTH_LOGIN_CANCELLED", "Google sign-in was cancelled.");
    }
    if (code === undefined) {
      return sendApiError(
        reply,
        400,
        "AUTH_LOGIN_FAILED",
        "Google sign-in could not be completed.",
      );
    }

    const provider = dependencies.googleProvider;
    const redirectUri = options.googleRedirectUri;
    if (provider === undefined || redirectUri === undefined) {
      return sendApiError(
        reply,
        503,
        "AUTH_PROVIDER_UNAVAILABLE",
        "Google sign-in is temporarily unavailable.",
      );
    }

    let identity: VerifiedGoogleIdentity;
    try {
      identity = await provider.exchangeAuthorizationCode({
        code,
        redirectUri,
        state,
        nonce: transaction.nonce,
        codeVerifier: transaction.codeVerifier,
      });
    } catch {
      request.log.warn("Google identity exchange failed");
      return sendApiError(
        reply,
        503,
        "AUTH_PROVIDER_UNAVAILABLE",
        "Google sign-in is temporarily unavailable.",
      );
    }

    if (!identity.emailVerified || identity.subject.trim() === "" || identity.email.trim() === "") {
      return sendApiError(reply, 403, "AUTH_LOGIN_FAILED", "Google sign-in was not accepted.");
    }

    const currentSession = getActiveSession(request, dependencies);
    const resolution = await dependencies.userDirectory.resolveGoogleIdentity(identity);
    if (resolution.kind !== "authenticated") {
      return sendApiError(reply, 403, "AUTH_LOGIN_FAILED", "Google sign-in was not accepted.");
    }
    if (
      currentSession !== null &&
      currentSession.principal.userId !== resolution.principal.userId
    ) {
      return sendApiError(reply, 409, "AUTH_LOGIN_FAILED", "Sign out before switching accounts.");
    }

    const session =
      currentSession === null
        ? dependencies.sessionStore.create(resolution.principal, dependencies.now())
        : dependencies.sessionStore.rotate(
            currentSession.sessionId,
            resolution.principal,
            dependencies.now(),
          );
    if (session === null) {
      return sendApiError(reply, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }

    setSessionCookies(reply, session, dependencies.secureCookies);
    return reply.redirect(transaction.returnTo);
  });

  server.get("/api/v1/me/access", async (request, reply) => {
    const session = getActiveSession(request, dependencies);
    if (session === null) {
      return sendApiError(reply, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }
    return reply.send(createSuccessResponse({ userId: session.principal.userId }));
  });

  server.get("/api/v1/staff/access", async (request, reply) => {
    const session = getActiveSession(request, dependencies);
    if (session === null) {
      return sendApiError(reply, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }
    const canUseStaffWorkspace =
      (hasRole(session.principal, "staff") || hasRole(session.principal, "admin")) &&
      hasPermission(session.principal, "application_read");
    if (!canUseStaffWorkspace) {
      return sendApiError(reply, 403, "FORBIDDEN", "Staff permission is required.");
    }
    return reply.send(
      createSuccessResponse({ userId: session.principal.userId, audience: "staff" }),
    );
  });

  server.get("/api/v1/admin/access", async (request, reply) => {
    const session = getActiveSession(request, dependencies);
    if (session === null) {
      return sendApiError(reply, 401, "AUTHENTICATION_REQUIRED", "Authentication is required.");
    }
    if (
      !hasRole(session.principal, "admin") ||
      !hasPermission(session.principal, "permissions_manage")
    ) {
      return sendApiError(reply, 403, "FORBIDDEN", "Admin permission is required.");
    }
    return reply.send(
      createSuccessResponse({ userId: session.principal.userId, audience: "admin" }),
    );
  });
}

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
): FastifyReply {
  reply.header("cache-control", "no-store");
  return reply.code(statusCode).send({ error: { code, message } });
}

function getActiveSession(
  request: FastifyRequest,
  dependencies: AuthBoundaryDependencies,
): SessionRecord | null {
  const sessionId = getCookie(request.headers.cookie, SESSION_COOKIE_NAME);
  if (sessionId === undefined) {
    return null;
  }

  const session = dependencies.sessionStore.get(sessionId, dependencies.now());
  if (session === null || session.principal.status === "disabled") {
    dependencies.sessionStore.revoke(sessionId);
    return null;
  }
  return session;
}

function setSessionCookies(reply: FastifyReply, session: SessionRecord, secure: boolean): void {
  const attributes = [`Path=/`, `SameSite=Lax`, ...(secure ? [`Secure`] : [])];
  reply.header("set-cookie", [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.sessionId)}; HttpOnly; ${attributes.join("; ")}`,
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(session.csrfToken)}; ${attributes.join("; ")}`,
  ]);
}

function clearSessionCookies(reply: FastifyReply, secure: boolean): void {
  const attributes = [`Path=/`, `SameSite=Lax`, `Max-Age=0`, ...(secure ? [`Secure`] : [])];
  reply.header("set-cookie", [
    `${SESSION_COOKIE_NAME}=; HttpOnly; ${attributes.join("; ")}`,
    `${CSRF_COOKIE_NAME}=; ${attributes.join("; ")}`,
  ]);
}

function hasValidCsrfToken(request: FastifyRequest, expectedToken: string): boolean {
  const header = request.headers["x-csrf-token"];
  const suppliedToken = Array.isArray(header) ? header[0] : header;
  if (suppliedToken === undefined) {
    return false;
  }

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

function readQueryString(query: unknown, key: string): string | undefined {
  if (!isRecord(query)) {
    return undefined;
  }
  const value = query[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      const value = valueParts.join("=");
      if (value === "") {
        return undefined;
      }
      try {
        return decodeURIComponent(value);
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

function getSafeReturnTo(
  returnTo: string | undefined,
  allowedOrigins: readonly string[],
): string | null {
  const fallback = allowedOrigins[0];
  if (fallback === undefined) {
    return null;
  }
  if (returnTo === undefined) {
    return fallback;
  }

  try {
    const parsed = new URL(returnTo);
    if (parsed.username !== "" || parsed.password !== "" || parsed.hash !== "") {
      return null;
    }
    return allowedOrigins.includes(parsed.origin) ? parsed.href : null;
  } catch {
    return null;
  }
}

function createCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
