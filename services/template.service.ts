import pool from '@/lib/db';

export interface DocumentTemplate {
  id: number;
  title: string;
  description: string;
  content_template: string;
  required_fields: {
    key: string;
    label: string;
    type: 'string' | 'number' | 'date';
    description: string;
  }[];
  created_at: Date;
}

export const DEFAULT_TEMPLATES = [
  {
    title: 'عقد كراء سكني',
    description: 'عقد إيجار مخصص للعقارات السكنية وفق القوانين المعمول بها، يحدد حقوق وواجبات المكري والمكتري.',
    required_fields: [
      { key: 'lessor_name', label: 'اسم المؤجر (المكري)', type: 'string', description: 'الاسم الكامل للمؤجر ورقم بطاقته الوطنية' },
      { key: 'tenant_name', label: 'اسم المستأجر (المكتري)', type: 'string', description: 'الاسم الكامل للمستأجر ورقم بطاقته الوطنية' },
      { key: 'property_address', label: 'عنوان العقار', type: 'string', description: 'العنوان الكامل للشقة أو المنزل المؤجر' },
      { key: 'rent_amount', label: 'السومة الكرائية (المبلغ الشهري)', type: 'number', description: 'مبلغ الكراء المتفق عليه شهرياً بالدرهم أو العملة المحلية' },
      { key: 'deposit_amount', label: 'مبلغ الضمانة (التأمين)', type: 'number', description: 'مبلغ التأمين أو الضمان المسترجع عند نهاية العقد' },
      { key: 'start_date', label: 'تاريخ بداية العقد', type: 'date', description: 'تاريخ بدء سريان الإيجار' },
      { key: 'duration_months', label: 'مدة العقد (بالشهور)', type: 'number', description: 'مدة الكراء مثلاً 12 شهراً قابلة للتجديد' }
    ],
    content_template: `
# عقد كراء سكني

**الطرف الأول (المؤجر/المكري):** {{lessor_name}}
**الطرف الثاني (المستأجر/المكتري):** {{tenant_name}}

### موضوع العقد:
يؤجر الطرف الأول للطرف الثاني العقار الكائن بـ: {{property_address}} لاستعماله في السكن فقط.

### الشروط المالية والمدة:
1. **مدة العقد:** محددة في {{duration_months}} شهراً، تبتدئ من تاريخ {{start_date}}.
2. **السومة الكرائية:** حددت بمبلغ وقدره {{rent_amount}} شهرياً تؤدى في بداية كل شهر.
3. **الضمانة:** دفع المستأجر مبلغ {{deposit_amount}} كضمانة تسترجع عند تسليم المحل بالحالة التي استلمه بها.

حرر هذا العقد في نسختين أصليتين وموقعتين بحسن نية.
    `.trim()
  },
  {
    title: 'عقد بيع سيارة مستعملة',
    description: 'عقد عرفي لبيع وتفويت مركبة أو سيارة مستعملة مع تحديد المواصفات والثمن وطريقة الأداء.',
    required_fields: [
      { key: 'seller_name', label: 'اسم البائع', type: 'string', description: 'الاسم الكامل للبائع ورقم هويته' },
      { key: 'buyer_name', label: 'اسم المشتري', type: 'string', description: 'الاسم الكامل للمشتري ورقم هويته' },
      { key: 'car_model', label: 'نوع وموديل السيارة', type: 'string', description: 'النوع، الماركة وسنة الصنع' },
      { key: 'license_plate', label: 'رقم اللوحة المعدنية (الترقيم)', type: 'string', description: 'رقم تسجيل السيارة' },
      { key: 'sale_price', label: 'ثمن البيع الإجمالي', type: 'number', description: 'المبلغ الإجمالي المتفق عليه للبيع' },
      { key: 'sale_date', label: 'تاريخ البيع', type: 'date', description: 'تاريخ إبرام الاتفاق وتسليم المركبة' }
    ],
    content_template: `
# عقد بيع وتفويت مركبة مستعملة

**بين الموقعين أسفله:**
- **البائع:** السيد(ة) {{seller_name}}
- **المشتري:** السيد(ة) {{buyer_name}}

### موضوع البيع:
باع الطرف الأول وأسقط وتخلى مع كافة الضمانات الفعلية والقانونية للطرف الثاني القابل لذلك، المركبة الآتية مواصفاتها:
- **النوع والموديل:** {{car_model}}
- **رقم التسجيل (اللوحة):** {{license_plate}}

### الثمن وطريقة الأداء:
تم هذا البيع وقبل بثمن إجمالي قدره {{sale_price}}، صرح البائع بأنه قبضه نقداً أو تحويلاً وأبرأ المشتري منه.
تاريخ المعاملة والتسليم: {{sale_date}}.
    `.trim()
  }
];

export class TemplateService {
  static async getAllTemplates(): Promise<DocumentTemplate[]> {
    const res = await pool.query('SELECT * FROM document_templates ORDER BY id ASC');
    if (res.rows.length === 0) {
      await this.seedDefaultTemplates();
      const retryRes = await pool.query('SELECT * FROM document_templates ORDER BY id ASC');
      return retryRes.rows;
    }
    return res.rows;
  }

  static async getTemplateById(id: number): Promise<DocumentTemplate | null> {
    const res = await pool.query('SELECT * FROM document_templates WHERE id = $1', [id]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  static async seedDefaultTemplates(): Promise<void> {
    for (const t of DEFAULT_TEMPLATES) {
      await pool.query(
        `INSERT INTO document_templates (title, description, content_template, required_fields)
         VALUES ($1, $2, $3, $4)`,
        [t.title, t.description, t.content_template, JSON.stringify(t.required_fields)]
      );
    }
  }
}
