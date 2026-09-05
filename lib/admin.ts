import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import { findUserById, SafeUser } from '@/services/auth.service';

export async function verifyAdmin(): Promise<{ authorized: boolean; user?: SafeUser; error?: string; status: number }> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('sanad_token')?.value;

    if (!token) {
      return { authorized: false, error: 'غير مسجل الدخول، يرجى تسجيل الدخول أولاً', status: 401 };
    }

    const payload = await verifyToken(token);
    if (!payload || !payload.userId) {
      return { authorized: false, error: 'جلسة غير صالحة أو منتهية', status: 401 };
    }

    const user = await findUserById(payload.userId);
    if (!user) {
      return { authorized: false, error: 'المستخدم غير موجود', status: 404 };
    }

    if (user.role !== 'admin') {
      return { authorized: false, error: 'غير مصرح لك بالوصول، يتطلب صلاحيات مدير النظام (Admin)', status: 403 };
    }

    return { authorized: true, user, status: 200 };
  } catch (error: any) {
    return { authorized: false, error: 'حدث خطأ أثناء التحقق من الصلاحيات', status: 500 };
  }
}
