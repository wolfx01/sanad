import pool from '@/lib/db';
import { TemplateService } from './template.service';

export class DocumentService {
  /**
   * صياغة محتوى المستند النهائي بدمج البيانات مع القالب
   */
  static async renderDocument(templateId: number, fields: Record<string, any>) {
    const template = await TemplateService.getTemplateById(templateId);
    if (!template) throw new Error('القالب غير موجود');

    let rendered = template.content_template;

    for (const [key, val] of Object.entries(fields)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(val));
    }

    // استبدال أي حقول متبقية بنقاط فارغة
    rendered = rendered.replace(/{{\\s*\\w+\\s*}}/g, '.......................');

    return {
      templateTitle: template.title,
      content: rendered,
    };
  }

  /**
   * حفظ المستند في سجل المستندات المولدة
   */
  static async saveGeneratedDocument(
    userId: number | null,
    templateId: number,
    userData: Record<string, any>,
    renderedContent: string
  ) {
    const res = await pool.query(
      `INSERT INTO generated_documents (template_id, user_data, file_path)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [templateId, JSON.stringify(userData), 'in-app-text-render']
    );
    return res.rows[0];
  }
}
