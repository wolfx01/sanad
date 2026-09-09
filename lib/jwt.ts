import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development_purposes_only';
const encodedKey = new TextEncoder().encode(JWT_SECRET);

export interface UserTokenPayload {
  userId: number;
  email: string;
  name: string;
  role: string;
}

export async function signToken(payload: UserTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

export async function verifyToken(token: string): Promise<UserTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload as unknown as UserTokenPayload;
  } catch (error) {
    return null;
  }
}
