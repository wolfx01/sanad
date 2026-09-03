import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: 'مسار المحادثة قيد الإنشاء' });
}
