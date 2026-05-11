import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { env } from "@/lib/env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

const ALG = "HS256";
const ISSUER = "master-crm";
const AUDIENCE = "master-crm-users";
const SESSION_EXPIRES = "7d";

export interface SessionPayload extends JWTPayload {
  uid: string;        // user id
  wid: string;        // workspace id
  role: string;       // owner | admin | agent
  email: string;
}

export async function signSession(payload: Omit<SessionPayload, keyof JWTPayload>) {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRES)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: [ALG],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}
