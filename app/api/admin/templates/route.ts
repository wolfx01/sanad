import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await pool.query(`
      SELECT 
        dt.id, 
        dt.title, 
        dt.description, 
        dt.required_fields, 
        dt.content_template,
        dt.created_at,
        COUNT(gd.id) AS total_generated
      FROM document_templates dt
      LEFT JOIN generated_documents gd ON gd.template_id = dt.id
      GROUP BY dt.id, dt.title, dt.description, dt.required_fields, dt.content_template, dt.created_at
      ORDER BY dt.id ASC
    `);

    return NextResponse.json({ templates: result.rows });
  } catch (error: any) {
    console.error('Admin templates GET error:', error);
    return NextResponse.json({ error: 'تعذر جلب القوالب القانونية' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { title, description, required_fields, content_template } = body;

    if (!title || !description || !content_template) {
      return NextResponse.json({ error: 'يرجى إدخال جميع الحقول الإلزامية للقالب' }, { status: 400 });
    }

    const res = await pool.query(
      `INSERT INTO document_templates (title, description, required_fields, content_template)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        JSON.stringify(required_fields || []),
        content_template.trim()
      ]
    );

    return NextResponse.json({ template: res.rows[0], message: 'تمت إضافة القالب بنجاح' });
  } catch (error: any) {
    console.error('Admin templates POST error:', error);
    return NextResponse.json({ error: 'تعذر حفظ القالب الجديد' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { id, title, description, required_fields, content_template } = body;

    if (!id || !title || !description || !content_template) {
      return NextResponse.json({ error: 'معطيات القالب غير مكتملة' }, { status: 400 });
    }

    const res = await pool.query(
      `UPDATE document_templates 
       SET title = $1, description = $2, required_fields = $3, content_template = $4
       WHERE id = $5
       RETURNING *`,
      [
        title.trim(),
        description.trim(),
        JSON.stringify(required_fields || []),
        content_template.trim(),
        id
      ]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'القالب غير موجود' }, { status: 404 });
    }

    return NextResponse.json({ template: res.rows[0], message: 'تم تحديث القالب بنجاح' });
  } catch (error: any) {
    console.error('Admin templates PUT error:', error);
    return NextResponse.json({ error: 'تعذر تعديل القالب' }, { status: 500 });
  }
}
