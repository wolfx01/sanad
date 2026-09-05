import { NextResponse } from 'next/server';
import { TemplateService } from '@/services/template.service';

export async function GET() {
  try {
    const templates = await TemplateService.getAllTemplates();
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json({ error: 'تعذر جلب قوالب المستندات' }, { status: 500 });
  }
}

