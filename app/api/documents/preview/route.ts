import { NextRequest, NextResponse } from 'next/server';
import { DocumentService } from '@/services/document.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, fields } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'رقم القالب مطلوب' }, { status: 400 });
    }

    const doc = await DocumentService.renderDocument(Number(templateId), fields || {});
    return NextResponse.json(doc);
  } catch (error: any) {
    console.error('Error rendering document preview:', error);
    return NextResponse.json({ error: error.message || 'تعذر إعداد المستند' }, { status: 500 });
  }
}
