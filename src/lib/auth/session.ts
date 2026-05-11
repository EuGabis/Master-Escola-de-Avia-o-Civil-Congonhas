import { cookies } from "next/headers";
import { signSession, verifySession, type SessionPayload } from "./jwt";

const COOKIE_NAME = "ms_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias em segundos

/**
 * Cria a sessao do usuario e seta o cookie httpOnly.
 * - httpOnly: nao acessivel por JS (protege contra XSS)
 * - secure: HTTPS only em prod
 * - sameSite=lax: protege contra CSRF (form externos nao enviam)
 * - path=/: valido em todo o app
 */
export async function createSession(payload: Omit<SessionPayload, "iss" | "aud" | "iat" | "exp">) {
  const token = await signSession(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME };
