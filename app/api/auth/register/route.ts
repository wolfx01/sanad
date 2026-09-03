import { NextResponse } from 'next/server';
import { registerUser } from '@/services/auth.service';
import { signToken } from '@/lib/jwt';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'يرجى إدخال اسم صحيح مكون من حرفين على الأقل' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'يرجى إدخال بريد إلكتروني صحيح' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن لا تقل عن 6 خانات' },
        { status: 400 }
      );
    }

    const user = await registerUser(name, email, password);

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const response = NextResponse.json({
      message: 'تم إنشاء الحساب بنجاح',
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
      { error: error?.message || 'حدث خطأ أثناء إنشاء الحساب' },
      { status: 400 }
    );
  }
}
