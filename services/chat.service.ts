import OpenAI from 'openai';
import pool from '@/lib/db';
import { TemplateService, DocumentTemplate } from './template.service';

function getAiClient() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const isRouter = apiKey.startsWith('sk-or-') || Boolean(process.env.AI_BASE_URL);
  const baseURL = process.env.AI_BASE_URL || (apiKey.startsWith('sk-or-') ? 'https://openrouter.ai/api/v1' : undefined);
  const defaultHeaders = isRouter
    ? {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Sanad Legal AI',
      }
    : undefined;

  return {
    client: new OpenAI({
      apiKey,
      baseURL,
      defaultHeaders,
    }),
    model: process.env.AI_MODEL || (isRouter ? 'openai/gpt-4o-mini' : 'gpt-4o-mini'),
  };
}

export interface ChatResponse {
  sessionId: number;
  reply: string;
  templateId: number | null;
  templateTitle: string | null;
  extractedFields: Record<string, any>;
  requiredFields: DocumentTemplate['required_fields'] | null;
  isComplete: boolean;
  aiMode: 'ai_live' | 'rule_fallback';
}

export class ChatService {
  /**
   * معالجة رسالة المحادثة وإرجاع الرد مع استخراج البيانات
   */
  static async processMessage(
    userId: number | null,
    sessionId: number | null,
    userMessage: string
  ): Promise<ChatResponse> {
    const templates = await TemplateService.getAllTemplates();

    // 1. استرجاع أو إنشاء الجلسة
    let currentSessionId = sessionId;
    let templateId: number | null = null;
    let extractedFields: Record<string, any> = {};

    if (currentSessionId) {
      const sessionRes = await pool.query(
        'SELECT * FROM chat_sessions WHERE id = $1',
        [currentSessionId]
      );
      if (sessionRes.rows.length > 0) {
        const s = sessionRes.rows[0];
        templateId = s.template_id;
        extractedFields = s.extracted_fields || {};
      }
    } else {
      const newSession = await pool.query(
        'INSERT INTO chat_sessions (user_id, title, extracted_fields) VALUES ($1, $2, $3) RETURNING id',
        [userId, 'محادثة صياغة عقد', JSON.stringify({})]
      );
      currentSessionId = newSession.rows[0].id;
    }

    // 2. حفظ رسالة المستخدم في قاعدة البيانات
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [currentSessionId, 'user', userMessage]
    );

    // 3. جلب آخر الرسائل للسياق
    const historyRes = await pool.query(
      'SELECT role, content FROM chat_messages WHERE session_id = $1 ORDER BY id DESC LIMIT 10',
      [currentSessionId]
    );
    const history = historyRes.rows.reverse();

    // 4. محاولة المعالجة عبر الذكاء الاصطناعي (OpenAI / OpenRouter)
    let parsed: {
      template_id?: number | null;
      reply?: string;
      new_extracted_fields?: Record<string, any>;
      is_complete?: boolean;
    } | null = null;

    let aiMode: 'ai_live' | 'rule_fallback' = 'ai_live';
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey && (apiKey.startsWith('sk-') || apiKey.startsWith('sk-or-'))) {
      try {
        const { client, model } = getAiClient();

        let activeTemplate: DocumentTemplate | null = null;
        if (templateId) {
          activeTemplate = templates.find((t) => t.id === templateId) || null;
        }

        // حساب الحقول الناقصة لهذا القالب لإلزام الذكاء الاصطناعي بها بدقة
        const pendingFields = activeTemplate
          ? activeTemplate.required_fields.filter(
              (f) => !extractedFields[f.key] || String(extractedFields[f.key]).trim() === ''
            )
          : [];

        const systemPrompt = `
أنت "سند"، مساعد ذكي متخصص في صياغة العقود والمستندات القانونية باللغة العربية بأسلوب ودود وموجز ومهني.

القوالب المتاحة في النظام:
${templates
  .map(
    (t) => `- قالب رقم ${t.id}: "${t.title}"
  الحقول الإلزامية (${t.required_fields.length} حقول): ${t.required_fields.map((f) => `${f.key} (${f.label})`).join(', ')}`
  )
  .join('\n')}

الحالة الحالية:
- القالب المختار: ${activeTemplate ? `رقم ${activeTemplate.id} (${activeTemplate.title})` : 'لم يحدد بعد'}
- الحقول التي تم جمعها حتى الآن: ${JSON.stringify(extractedFields)}
${
  activeTemplate
    ? `- الحقول المتبقية المطلوب جمعها إلزامياً (${pendingFields.length} حقول متبقية):
${pendingFields.map((f) => `  * ${f.key}: ${f.label}`).join('\n')}`
    : ''
}

مهامك الصارمة:
1. إذا لم يتحدد القالب، اقترحه أو اسأل عنه بناءً على رسالة العميل.
2. استخرج من رسالة المستخدم أي قيم تطابق الحقول المطلوبة وضعها في new_extracted_fields.
3. تفقد الحقول المتبقية الناقصة واطلبها بلباقة (اسأل عن حقل أو حقلين على الأكثر في كل رسالة).
4. تحذير حاسم: لا تجعل is_complete أبداً true إذا كان هناك أي حقل من الحقول الإلزامية لم يقدمه المستخدم بعد! فقط وحصراً عندما يتم استخراج كل الحقول الإلزامية بنسبة 100% اجعل is_complete: true.
5. أجب حصراً بصيغة JSON:
{
  "template_id": <رقم أو null>,
  "reply": "<ردك التفاعلي>",
  "new_extracted_fields": { "<key>": "<value>" },
  "is_complete": <true/false>
}
`.trim();

        const response = await client.chat.completions.create({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          ],
        });

        const rawContent = response.choices[0]?.message?.content || '{}';
        parsed = JSON.parse(rawContent);
      } catch (err: any) {
        console.warn('AI API call error (falling back to local engine):', err.message);
        parsed = null;
      }
    }

    // 5. إذا تعذر الاتصال، نستخدم المحرك الاحتياطي الذكي
    if (!parsed) {
      aiMode = 'rule_fallback';
      parsed = this.fallbackRuleEngine(userMessage, templateId, extractedFields, templates);
    }

    let targetSessionId = currentSessionId;
    let newTemplateId = parsed.template_id || templateId;

    // إذا كان العقد السابق في هذه الجلسة مكتملاً 100%، واختار المستخدم عقداً جديداً:
    // ننشئ جلسة جديدة تلقائياً للحفاظ على العقد السابق نظيفاً في السجل!
    if (templateId && newTemplateId && newTemplateId !== templateId) {
      const oldTemplate = templates.find((t) => t.id === templateId);
      const wasOldCompleted =
        oldTemplate &&
        oldTemplate.required_fields.every(
          (f) => extractedFields[f.key] !== undefined && extractedFields[f.key] !== ''
        );

      if (wasOldCompleted) {
        const chosenTemplate = templates.find((t) => t.id === newTemplateId);
        const newSessionRes = await pool.query(
          'INSERT INTO chat_sessions (user_id, title, template_id, extracted_fields) VALUES ($1, $2, $3, $4) RETURNING id',
          [
            userId,
            chosenTemplate ? chosenTemplate.title : 'محادثة صياغة عقد',
            newTemplateId,
            JSON.stringify(parsed.new_extracted_fields || {}),
          ]
        );
        targetSessionId = newSessionRes.rows[0].id;
        extractedFields = {}; // تصفير الحقول للجلسة الجديدة
      }
    }

    const mergedFields = {
      ...extractedFields,
      ...(parsed.new_extracted_fields || {}),
    };

    const currentTemplate = templates.find((t) => t.id === newTemplateId) || null;

    // فحص صارم ومحكم على مستوى الخادم: هل اكتملت جميع الحقول فعلياً؟
    const missingKeys = currentTemplate
      ? currentTemplate.required_fields.filter(
          (f) =>
            mergedFields[f.key] === undefined ||
            mergedFields[f.key] === null ||
            String(mergedFields[f.key]).trim() === ''
        )
      : [];

    const allRequiredPresent = currentTemplate ? missingKeys.length === 0 : false;
    let isComplete = Boolean(parsed.is_complete) && allRequiredPresent;

    let replyText = parsed.reply || 'مرحباً، كيف يمكنني مساعدتك اليوم؟';

    // إذا ادعى الذكاء الاصطناعي اكتمال العقد بالخطأ مع وجود حقول لم يتم جمعها، نرفض الإكمال ونسأل عن الحقل الناقص فوراً!
    if (!isComplete && missingKeys.length > 0 && parsed.is_complete) {
      const nextField = missingKeys[0];
      replyText = `شكراً لك على هذه المعطيات. لإنهاء صياغة ${currentTemplate?.title} بدقة، يرجى تزويدي بالآتي:\n${nextField.label}`;
    }

    // إذا اكتمل العقد بنسبة 100%، نقوم بتثبيت وسم العقد بشكل دائم داخل الرسالة وحفظه
    if (isComplete && currentTemplate) {
      try {
        await pool.query(
          'INSERT INTO generated_documents (template_id, user_data, file_path) VALUES ($1, $2, $3)',
          [newTemplateId, JSON.stringify(mergedFields), 'completed']
        );
      } catch (e) {
        console.error('Failed to save to generated_documents:', e);
      }

      const actionData = JSON.stringify({
        templateId: newTemplateId,
        title: currentTemplate.title,
        fields: mergedFields,
      });

      if (!replyText.includes('[CONTRACT_ACTION:')) {
        replyText += `\n\n[CONTRACT_ACTION:${actionData}]`;
      }
    }

    // 6. تحديث الجلسة في قاعدة البيانات
    if (newTemplateId && newTemplateId !== templateId) {
      const chosenTemplate = templates.find((t) => t.id === newTemplateId);
      if (chosenTemplate) {
        await pool.query(
          'UPDATE chat_sessions SET template_id = $1, title = $2, extracted_fields = $3 WHERE id = $4',
          [newTemplateId, chosenTemplate.title, JSON.stringify(mergedFields), targetSessionId]
        );
      }
    } else {
      await pool.query(
        'UPDATE chat_sessions SET extracted_fields = $1 WHERE id = $2',
        [JSON.stringify(mergedFields), targetSessionId]
      );
    }

    // 7. حفظ رد المساعد في جدول الرسائل
    await pool.query(
      'INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)',
      [targetSessionId, 'assistant', replyText]
    );

    return {
      sessionId: targetSessionId!,
      reply: replyText,
      templateId: newTemplateId,
      templateTitle: currentTemplate ? currentTemplate.title : null,
      extractedFields: mergedFields,
      requiredFields: currentTemplate ? currentTemplate.required_fields : null,
      isComplete,
      aiMode,
    };

  }

  /**
   * محرك ذكي احتياطي لجمع البيانات تلقائياً
   */
  private static fallbackRuleEngine(
    userMessage: string,
    currentTemplateId: number | null,
    currentFields: Record<string, any>,
    templates: DocumentTemplate[]
  ) {
    let templateId = currentTemplateId;
    const lower = userMessage.toLowerCase();

    if (!templateId) {
      if (lower.includes('كراء') || lower.includes('شقة') || lower.includes('إيجار') || lower.includes('منزل')) {
        templateId = 1;
      } else if (lower.includes('سيارة') || lower.includes('بيع') || lower.includes('مركبة') || lower.includes('طوموبيل')) {
        templateId = 2;
      }
    }

    if (!templateId) {
      return {
        template_id: null,
        reply: 'مرحباً بك في "سند"! يسعدني مساعدتك في صياغة مستندك القانوني. حالياً نوفر:\n1. عقد كراء سكني\n2. عقد بيع سيارة مستعملة\n\nأي منهما تود صياغته اليوم؟',
        new_extracted_fields: {},
        is_complete: false,
      };
    }

    const template = templates.find((t) => t.id === templateId)!;
    const newFields: Record<string, any> = {};

    const numbersMatch = userMessage.match(/\b\d{2,7}\b/g);
    if (numbersMatch) {
      if (templateId === 1 && !currentFields.rent_amount) {
        newFields.rent_amount = parseInt(numbersMatch[0]);
      } else if (templateId === 2 && !currentFields.sale_price) {
        newFields.sale_price = parseInt(numbersMatch[0]);
      }
    }

    const merged = { ...currentFields, ...newFields };
    const missing = template.required_fields.filter((f) => !merged[f.key]);

    if (missing.length === 0) {
      return {
        template_id: templateId,
        reply: `ممتاز! تم جمع جميع المعلومات اللازمة لـ "${template.title}". المستند جاهز الآن للمعاينة والتوليد بصيغة PDF.`,
        new_extracted_fields: newFields,
        is_complete: true,
      };
    }

    const nextField = missing[0];
    let reply = '';
    if (Object.keys(currentFields).length === 0 && Object.keys(newFields).length === 0) {
      reply = `أهلاً بك! سأساعدك في إعداد "${template.title}". للبدء، يرجى تزويدي بـ: ${nextField.label} (${nextField.description}).`;
    } else {
      reply = `شكراً لك! الخطوة التالية: يرجى تزويدي بـ ${nextField.label} (${nextField.description}).`;
    }

    return {
      template_id: templateId,
      reply,
      new_extracted_fields: newFields,
      is_complete: false,
    };
  }

  /**
   * استرجاع رسائل جلسة معينة
   */
  static async getSessionMessages(sessionId: number) {
    const res = await pool.query(
      'SELECT id, role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY id ASC',
      [sessionId]
    );
    return res.rows;
  }

  /**
   * استرجاع جميع جلسات المستخدم
   */
  static async getUserSessions(userId: number) {
    const res = await pool.query(
      `SELECT s.id, s.title, s.template_id, s.extracted_fields, s.created_at,
              t.title as template_title
       FROM chat_sessions s
       LEFT JOIN document_templates t ON s.template_id = t.id
       WHERE s.user_id = $1
       ORDER BY s.id DESC`,
      [userId]
    );
    return res.rows;
  }

  /**
   * استرجاع تفاصيل جلسة معينة مع رسائلها وحالتها
   */
  static async getSessionDetails(sessionId: number, userId: number) {
    const sessionRes = await pool.query(
      `SELECT s.id, s.title, s.template_id, s.extracted_fields, s.created_at,
              t.title as template_title, t.required_fields
       FROM chat_sessions s
       LEFT JOIN document_templates t ON s.template_id = t.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [sessionId, userId]
    );

    if (sessionRes.rows.length === 0) return null;
    const session = sessionRes.rows[0];

    const messages = await this.getSessionMessages(sessionId);

    // التحقق من اكتمال الحقول
    const extracted = session.extracted_fields || {};
    const required = session.required_fields || [];
    const isComplete =
      required.length > 0 &&
      required.every(
        (f: any) => extracted[f.key] !== undefined && extracted[f.key] !== ''
      );

    return {
      session,
      messages,
      isComplete,
      extractedFields: extracted,
      requiredFields: required,
      templateTitle: session.template_title,
      templateId: session.template_id,
    };
  }
}

