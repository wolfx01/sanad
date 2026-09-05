import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin';
import { getAllUsersWithStats, updateUserRole } from '@/services/auth.service';

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const users = await getAllUsersWithStats();
    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Admin users GET error:', error);
    return NextResponse.json({ error: 'تعذر جلب قائمة المستخدمين' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { userId, role } = body;

    if (!userId || !['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'معرف المستخدم أو الرتبة غير صالحة' }, { status: 400 });
    }

    // Protect super admin from self-demoting by accident
    if (auth.user?.id === userId && role !== 'admin') {
      return NextResponse.json({ error: 'لا يمكنك سحب صلاحية المدير من حسابك الحالي' }, { status: 400 });
    }

    const updatedUser = await updateUserRole(userId, role);
    return NextResponse.json({ user: updatedUser, message: 'تم تحديث صلاحية المستخدم بنجاح' });
  } catch (error: any) {
    console.error('Admin users PATCH error:', error);
    return NextResponse.json({ error: error.message || 'تعذر تحديث رتبة المستخدم' }, { status: 500 });
  }
}
