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
        gd.id, 
        gd.created_at, 
        gd.user_data,
        gd.template_id,
        dt.title AS template_title,
        dt.description AS template_description,
        dt.content_template,
        COALESCE(u.id, 0) AS user_id,
        COALESCE(u.name, 'مستخدم غير محدد') AS user_name,
        COALESCE(u.email, '-') AS user_email
      FROM generated_documents gd
      JOIN document_templates dt ON dt.id = gd.template_id
      LEFT JOIN users u ON u.id = gd.user_id
      ORDER BY gd.created_at DESC
      LIMIT 100
    `);

    return NextResponse.json({ documents: result.rows });
  } catch (error: any) {
    console.error('Admin documents GET error:', error);
    return NextResponse.json({ error: 'تعذر جلب سجل العقود' }, { status: 500 });
  }
}
