import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { ChatService } from '@/services/chat.service';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('sanad_token')?.value;
    let userId: number | null = null;
    if (token) {
      const payload = await verifyToken(token);
      if (payload) userId = payload.userId;
    }

    const body = await request.json();
    const { message, sessionId, stream } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'يرجى كتابة رسالة صحيحة' },
        { status: 400 }
      );
    }

    const readableStream = await ChatService.processMessageStream(
      userId,
      sessionId ? Number(sessionId) : null,
      message.trim()
    );

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform, private',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء معالجة المحادثة، يرجى المحاولة لاحقاً' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('sanad_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'غير مصرح لك' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'جلسة غير صالحة' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      const details = await ChatService.getSessionDetails(Number(sessionId), payload.userId);
      if (!details) {
        return NextResponse.json({ error: 'الجلسة غير موجودة' }, { status: 404 });
      }
      return NextResponse.json(details);
    }

    const sessions = await ChatService.getUserSessions(payload.userId);
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error('Error fetching chat history:', error);
    return NextResponse.json({ error: 'تعذر جلب سجل الرسائل' }, { status: 500 });
  }
}

