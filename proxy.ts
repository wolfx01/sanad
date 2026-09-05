import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/jwt';

// المسارات التي تتطلب تسجيل الدخول
const PROTECTED_PREFIXES = ['/api/chat', '/api/admin'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // التحقق مما إذا كان المسار محمياً
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected) {
    const token = request.cookies.get('sanad_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'غير مصرح لك، يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'جلسة غير صالحة أو منتهية، يرجى تسجيل الدخول مرة أخرى' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};