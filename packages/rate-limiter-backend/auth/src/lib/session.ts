import jwt from 'jsonwebtoken';

export interface SessionContext {
  tenantId: string;
}

const SESSION_TTL = '7d';

export function signSessionToken(session: SessionContext, secret: string): string {
  return jwt.sign(session, secret, { expiresIn: SESSION_TTL });
}

export function verifySessionToken(token: string, secret: string): SessionContext | null {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded !== 'object' || decoded === null || typeof decoded.tenantId !== 'string') {
      return null;
    }
    return { tenantId: decoded.tenantId };
  } catch {
    return null;
  }
}
