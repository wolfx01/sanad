import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyAdmin } from '@/lib/admin';

export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // 1. Total counts
    const usersCountRes = await pool.query('SELECT COUNT(*) FROM users');
    const docsCountRes = await pool.query('SELECT COUNT(*) FROM generated_documents');
    const sessionsCountRes = await pool.query('SELECT COUNT(*) FROM chat_sessions');
    const templatesCountRes = await pool.query('SELECT COUNT(*) FROM document_templates');

    // 2. Documents grouped by template
    const docsByTemplateRes = await pool.query(`
      SELECT 
        dt.id AS template_id, 
        dt.title, 
        COUNT(gd.id) AS count
      FROM document_templates dt
      LEFT JOIN generated_documents gd ON gd.template_id = dt.id
      GROUP BY dt.id, dt.title
      ORDER BY count DESC
    `);

    // 3. Recent documents
    const recentDocsRes = await pool.query(`
      SELECT 
        gd.id, 
        gd.created_at, 
        gd.user_data,
        dt.title AS template_title,
        COALESCE(u.name, 'مستخدم غير محدد') AS user_name,
        COALESCE(u.email, '-') AS user_email
      FROM generated_documents gd
      JOIN document_templates dt ON dt.id = gd.template_id
      LEFT JOIN users u ON u.id = gd.user_id
      ORDER BY gd.created_at DESC
      LIMIT 10
    `);

    // 4. Daily document generation trend (last 7 days)
    const trendRes = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') AS day,
        COUNT(*) AS count
      FROM generated_documents
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
      ORDER BY day ASC
    `);

    return NextResponse.json({
      stats: {
        totalUsers: parseInt(usersCountRes.rows[0].count, 10),
        totalDocuments: parseInt(docsCountRes.rows[0].count, 10),
        totalSessions: parseInt(sessionsCountRes.rows[0].count, 10),
        totalTemplates: parseInt(templatesCountRes.rows[0].count, 10),
      },
      documentsByTemplate: docsByTemplateRes.rows,
      recentDocuments: recentDocsRes.rows,
      trend: trendRes.rows,
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب إحصائيات النظام' }, { status: 500 });
  }
}
