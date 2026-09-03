import { NextResponse } from 'next/server';
import { authenticateUser } from '@/services/auth.service';
import { signToken } from '@/lib/jwt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' },
        { status: 400 }
      );
    }

    const user = await authenticateUser(email, password);

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      message: 'تم تسجيل الدخول بنجاح',
      user,
    });

    // تعيين الكوكي الآمن
    response.cookies.set({
      name: 'sanad_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 أيام
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'فشل تسجيل الدخول' },
      { status: 401 }
    );
  }
}
