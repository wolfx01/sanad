import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // يمرر الطلب طبيعياً في الوقت الحالي
  return NextResponse.next();
}

// تحديد المسارات التي يراقبها الـ Proxy
export const config = {
  matcher: ['/api/:path*'],
};