import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { AuthSession, PlatformRole, TenantRole } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'zcallagent_super_secure_jwt_session_signing_key_2026_x89';
export const AUTH_COOKIE_NAME = 'zca_session';

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 10);
}

export async function verifyPassword(plainText: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

export function signSessionToken(session: AuthSession): string {
  return jwt.sign(session, JWT_SECRET, { expiresIn: '72h' });
}

export function verifySessionToken(token: string): AuthSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthSession;
    return decoded;
  } catch (err) {
    return null;
  }
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function createSessionCookieHeader(token: string): string {
  const maxAge = 72 * 60 * 60; // 3 days
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader(): string {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
