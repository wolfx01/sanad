'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface StatData {
  totalUsers: number;
  totalDocuments: number;
  totalSessions: number;
  totalTemplates: number;
}

interface TemplateStat {
  template_id: number;
  title: string;
  count: string;
}

interface RecentDoc {
  id: number;
  created_at: string;
  user_data: Record<string, any>;
  template_title: string;
  user_name: string;
  user_email: string;
}

interface UserItem {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  total_documents: string;
  total_sessions: string;
}

interface TemplateItem {
  id: number;
  title: string;
  description: string;
  required_fields: Array<{ key: string; label: string; type: string; description: string }>;
  content_template: string;
  created_at: string;
  total_generated: string;
}

interface DocItem {
  id: number;
  created_at: string;
  user_data: Record<string, any>;
  template_id: number;
  template_title: string;
  template_description: string;
  content_template: string;
  user_id: number;
  user_name: string;
  user_email: string;
}

export interface ExtractedVariableField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date';
  description: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // Auth & Permissions State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'documents' | 'templates'>('overview');

  // Stats Data
  const [stats, setStats] = useState<StatData | null>(null);
  const [templateStats, setTemplateStats] = useState<TemplateStat[]>([]);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);

  // Users Tab State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  // Documents Tab State
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [docSearch, setDocSearch] = useState('');
  const [docFilter, setDocFilter] = useState<string>('all');

  // Templates Tab State
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);
  const [templateVariables, setTemplateVariables] = useState<ExtractedVariableField[]>([]);
  const [templateForm, setTemplateForm] = useState({
    title: '',
    description: '',
    content_template: '',
  });

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');

  // 1. Check Admin Auth on Mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          setAccessDenied(true);
          return;
        }
        const data = await res.json();
        if (!data.user || data.user.role !== 'admin') {
          setAccessDenied(true);
          return;
        }
        setCurrentUser(data.user);
        loadDashboardStats();
      } catch (err) {
        setAccessDenied(true);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Load Stats
  const loadDashboardStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setTemplateStats(data.documentsByTemplate || []);
        setRecentDocs(data.recentDocuments || []);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  // 3. Load Users
  const loadUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
  };

  // 4. Load Documents
  const loadDocuments = async () => {
    try {
      const res = await fetch('/api/admin/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
    }
  };

  // 5. Load Templates
  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/admin/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  // Trigger loading when tab changes
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'documents') loadDocuments();
      if (activeTab === 'templates') loadTemplates();
    }
  }, [activeTab, currentUser]);

  // Handle Role Change
  const handleToggleRole = async (userId: number, currentRole: 'admin' | 'user') => {
    const nextRole = currentRole === 'admin' ? 'user' : 'admin';
    const confirmMsg = nextRole === 'admin'
      ? 'هل أنت متأكد من ترقية هذا المستخدم إلى مشرف (Admin)؟ سيمتلك صلاحيات كاملة.'
      : 'هل أنت متأكد من سحب صلاحيات المشرف وتحويله إلى مستخدم عادي؟';

    if (!confirm(confirmMsg)) return;

    setUpdatingUserId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: nextRole } : u)));
        alert('تم تحديث صلاحية المستخدم بنجاح!');
      } else {
        alert(data.error || 'فشل التحديث');
      }
    } catch {
      alert('حدث خطأ أثناء تحديث الصلاحية');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // استخراج المتغيرات المحصورة بين {{}} تلقائياً من متن العقد مع الحفاظ على التعديلات الحالية
  const extractVariables = (text: string, currentVars: ExtractedVariableField[] = []): ExtractedVariableField[] => {
    const matches = Array.from(text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g));
    const uniqueKeys = Array.from(new Set(matches.map(m => m[1])));

    const currentMap = new Map(currentVars.map(v => [v.key, v]));

    return uniqueKeys.map(key => {
      if (currentMap.has(key)) {
        return currentMap.get(key)!;
      }
      let guessedType: 'string' | 'number' | 'date' = 'string';
      if (
        key.includes('price') ||
        key.includes('amount') ||
        key.includes('rent') ||
        key.includes('deposit') ||
        key.includes('months') ||
        key.includes('cost') ||
        key.includes('ثمن') ||
        key.includes('مبلغ')
      ) {
        guessedType = 'number';
      } else if (key.includes('date') || key.includes('time') || key.includes('تاريخ')) {
        guessedType = 'date';
      }

      let guessedLabel = key
        .replace(/_/g, ' ')
        .replace(/party one/i, 'ما هو الاسم الكامل للطرف الأول؟')
        .replace(/party two/i, 'ما هو الاسم الكامل للطرف الثاني؟')
        .replace(/seller name/i, 'ما هو الاسم الكامل للبائع؟')
        .replace(/buyer name/i, 'ما هو الاسم الكامل للمشتري؟')
        .replace(/lessor name/i, 'ما هو الاسم الكامل للمؤجر (المكري)؟')
        .replace(/tenant name/i, 'ما هو الاسم الكامل للمستأجر (المكتري)؟')
        .replace(/car model/i, 'ما هو نوع وموديل وسنة صنع السيارة؟')
        .replace(/license plate/i, 'ما هو رقم لوحة تسجيل السيارة؟')
        .replace(/sale price/i, 'ما هو ثمن البيع الإجمالي المتفق عليه؟')
        .replace(/sale date/i, 'ما هو تاريخ إبرام المعاملة والتسليم؟')
        .replace(/property address/i, 'ما هو العنوان الكامل للعقار المؤجر؟')
        .replace(/rent amount/i, 'كم تبلغ السومة الكرائية (المبلغ الشهري)؟')
        .replace(/deposit amount/i, 'كم يبلغ مبلغ الضمانة أو التأمين؟')
        .replace(/duration months/i, 'كم مدة العقد بالشهور؟');

      if (guessedLabel === key.replace(/_/g, ' ')) {
        guessedLabel = `ما هي قيمة ${key.replace(/_/g, ' ')}؟`;
      }

      return {
        key,
        label: guessedLabel,
        type: guessedType,
        description: `البيانات الخاصة بـ ${key}`,
      };
    });
  };

  // تعديل خصائص متغير معين
  const updateVariableField = (key: string, fieldName: keyof ExtractedVariableField, value: string) => {
    setTemplateVariables(prev =>
      prev.map(item => (item.key === key ? { ...item, [fieldName]: value } : item))
    );
  };

  // تحديث متن العقد واستخراج المتغيرات ديناميكياً
  const handleContentTemplateChange = (newText: string) => {
    setTemplateForm(prev => ({ ...prev, content_template: newText }));
    setTemplateVariables(prev => extractVariables(newText, prev));
  };

  // Open Template Modal (Create or Edit)
  const handleOpenTemplateModal = (template?: TemplateItem) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateForm({
        title: template.title,
        description: template.description,
        content_template: template.content_template,
      });
      const existingFields: ExtractedVariableField[] = (template.required_fields || []).map(f => ({
        key: f.key,
        label: f.label || '',
        type: (['string', 'number', 'date'].includes(f.type) ? f.type : 'string') as any,
        description: f.description || '',
      }));
      setTemplateVariables(extractVariables(template.content_template, existingFields));
    } else {
      setEditingTemplate(null);
      const initialContent = `# عقد جديد\n\n**بين الموقعين أسفله:**\n- الطرف الأول: {{party_one}}\n- الطرف الثاني: {{party_two}}\n\n### موضوع العقد والشروط:\nتم الاتفاق على {{agreement_subject}} بمبلغ إجمالي قدره {{total_amount}} درهم.\nتاريخ السريان: {{start_date}}.`;
      setTemplateForm({
        title: '',
        description: '',
        content_template: initialContent,
      });
      setTemplateVariables(extractVariables(initialContent, []));
    }
    setTemplateModalOpen(true);
  };

  // Save Template (Create / Update)
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (templateVariables.length === 0) {
      if (!confirm('لم يتم العثور على أي متغيرات بصيغة {{...}} في نص العقد. هل تريد حفظ القالب بدون حقول تفاعلية؟')) {
        return;
      }
    }

    const payload = {
      title: templateForm.title,
      description: templateForm.description,
      content_template: templateForm.content_template,
      required_fields: templateVariables,
    };

    try {
      if (editingTemplate) {
        const res = await fetch('/api/admin/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTemplate.id, ...payload }),
        });
        if (res.ok) {
          alert('تم تعديل القالب بنجاح!');
          setTemplateModalOpen(false);
          loadTemplates();
        } else {
          const d = await res.json();
          alert(d.error || 'تعذر حفظ التعديلات');
        }
      } else {
        const res = await fetch('/api/admin/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          alert('تمت إضافة القالب الجديد بنجاح!');
          setTemplateModalOpen(false);
          loadTemplates();
        } else {
          const d = await res.json();
          alert(d.error || 'تعذر إنشاء القالب');
        }
      }
    } catch {
      alert('حدث خطأ في الاتصال بالخادم');
    }
  };

  // Render Preview Document Content
  const handleOpenDocPreview = (doc: DocItem | RecentDoc) => {
    let rendered = (doc as any).content_template || '';
    const userData = doc.user_data || {};

    // If we have content_template, render variables
    if (rendered) {
      for (const [key, val] of Object.entries(userData)) {
        const reg = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        rendered = rendered.replace(reg, String(val));
      }
      rendered = rendered.replace(/{{\\s*\\w+\\s*}}/g, '.......................');
    } else {
      // Fallback display
      rendered = `# ${doc.template_title}\n\nتاريخ الإنشاء: ${new Date(doc.created_at).toLocaleDateString('ar-MA')}\n\n### البيانات المسجلة:\n` +
        Object.entries(userData).map(([k, v]) => `- **${k}:** ${v}`).join('\n');
    }

    setPreviewDoc(doc as DocItem);
    setPreviewContent(rendered);
  };

  // Print Document Clean
  const handlePrintClean = () => {
    if (!previewDoc) return;
    const docTitle = previewDoc.template_title || 'وثيقة قانونية';
    const printWindow = window.open('', '_blank', 'width=900,height=850');
    if (!printWindow) return;

    let partyFirst = 'توقيع الطرف الأول';
    let partySecond = 'توقيع الطرف الثاني';
    if (docTitle.includes('سيارة') || docTitle.includes('بيع')) {
      partyFirst = 'توقيع البائع';
      partySecond = 'توقيع المشتري';
    } else if (docTitle.includes('كراء') || docTitle.includes('إيجار')) {
      partyFirst = 'توقيع المؤجر (المكري)';
      partySecond = 'توقيع المستأجر (المكتري)';
    }

    const cleanBody = previewContent
      .replace(/^#\s+[^\n]+/m, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^###\s+(.*)/gm, '\n❖ $1:\n')
      .replace(/(?:\r?\n)+[ \t]*(?:توقيع|إمضاء)[\s\S]*$/i, '')
      .trim();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="utf-8" />
          <title>${docTitle}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: #ffffff;
              color: #111111;
              font-family: 'IBM Plex Sans Arabic', Arial, sans-serif;
              padding: 2.5cm 2cm;
              direction: rtl;
              line-height: 2.2;
              font-size: 11pt;
            }
            .legal-doc-header-band {
              text-align: center;
              border-bottom: 2px solid #2d1b4e;
              padding-bottom: 1.25rem;
              margin-bottom: 2rem;
            }
            .legal-doc-badge {
              font-size: 0.8rem;
              color: #6b6580;
              margin-bottom: 0.4rem;
              font-weight: 600;
            }
            .legal-doc-title {
              font-size: 1.8rem;
              font-weight: 700;
              color: #2d1b4e;
            }
            .legal-doc-body {
              white-space: pre-wrap;
              color: #000000;
              line-height: 2.2;
              font-size: 11pt;
            }
            .legal-signatures-wrap {
              margin-top: 3.5rem;
              padding-top: 1.5rem;
              border-top: 1px dashed #c4bcaf;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 2rem;
              text-align: center;
              page-break-inside: avoid;
            }
            .legal-sign-box {
              border: 1px dashed #d0c8be;
              border-radius: 8px;
              padding: 1.25rem 1rem;
              min-height: 120px;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .legal-sign-title { font-weight: 700; font-size: 0.95rem; color: #2d1b4e; }
            .legal-sign-line { color: #999; font-size: 0.8rem; margin-top: 2rem; }
            @page { size: A4 portrait; margin: 15mm; }
          </style>
        </head>
        <body>
          <div class="legal-doc-header-band">
            <div class="legal-doc-badge">وثيقة قانونية رسمية • منصة سند</div>
            <h1 class="legal-doc-title">${docTitle}</h1>
          </div>
          <div class="legal-doc-body">${cleanBody}</div>
          <div class="legal-signatures-wrap">
            <div class="legal-sign-box">
              <div class="legal-sign-title">${partyFirst}</div>
              <div class="legal-sign-line">...................................................</div>
            </div>
            <div class="legal-sign-box">
              <div class="legal-sign-title">${partySecond}</div>
              <div class="legal-sign-line">...................................................</div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, userSearch]);

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    let list = documents;
    if (docFilter !== 'all') {
      list = list.filter(d => String(d.template_id) === docFilter);
    }
    const q = docSearch.toLowerCase().trim();
    if (q) {
      list = list.filter(d =>
        d.template_title?.toLowerCase().includes(q) ||
        d.user_name?.toLowerCase().includes(q) ||
        d.user_email?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [documents, docFilter, docSearch]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.push('/login');
  };

  // Access Denied / Not Authenticated Screen
  if (authLoading) {
    return (
      <div className="admin-loading-screen">
        <div className="admin-spinner"></div>
        <p>جاري التحقق من صلاحيات المشرف...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="admin-denied-screen">
        <div className="admin-denied-card">
          <div className="admin-denied-icon">🛡️⛔</div>
          <h2>غير مصرح لك بالدخول</h2>
          <p>هذه المنطقة مخصصة حصراً لمدراء النظام (Admins) في منصة سند.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <Link href="/chat" className="admin-btn-primary">
              العودة إلى الشات 💬
            </Link>
            <Link href="/login" className="admin-btn-secondary">
              تسجيل الدخول بحساب آخر 🔑
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout" dir="rtl">
      {/* Sidebar Navigation */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-logo-mark">سند</div>
          <div className="admin-brand-info">
            <span className="admin-brand-name">لوحة الإدارة</span>
            <span className="admin-badge-role">مدير النظام (Admin)</span>
          </div>
        </div>

        <nav className="admin-nav">
          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <span className="admin-nav-icon">📊</span>
            <span>نظرة عامة ومقاييس</span>
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <span className="admin-nav-icon">👥</span>
            <span>إدارة المستخدمين</span>
            {users.length > 0 && <span className="admin-pill">{users.length}</span>}
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <span className="admin-nav-icon">📜</span>
            <span>العقود والوثائق</span>
            {stats && <span className="admin-pill">{stats.totalDocuments}</span>}
          </button>

          <button
            type="button"
            className={`admin-nav-item ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            <span className="admin-nav-icon">⚖️</span>
            <span>القوالب القانونية</span>
            {templates.length > 0 && <span className="admin-pill">{templates.length}</span>}
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <Link href="/chat" className="admin-chat-link">
            <span>💬 الانتقال لمنصة الشات</span>
          </Link>
          <div className="admin-user-profile">
            <div className="admin-avatar">
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="admin-user-details">
              <span className="admin-username">{currentUser?.name}</span>
              <span className="admin-useremail">{currentUser?.email}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="admin-btn-logout-icon"
              title="تسجيل الخروج"
            >
              🚪
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="admin-main">
        {/* Top Header */}
        <header className="admin-topbar">
          <div>
            <h1 className="admin-page-title">
              {activeTab === 'overview' && 'لوحة المؤشرات والنشاط الحي'}
              {activeTab === 'users' && 'سجل المستخدمين والصلاحيات'}
              {activeTab === 'documents' && 'سجل العقود والوثائق المنشأة'}
              {activeTab === 'templates' && 'إدارة وتخصيص القوالب القانونية'}
            </h1>
            <p className="admin-page-subtitle">
              إدارة شاملة لبيانات ومستندات منصة «سند» المغربية الذكية
            </p>
          </div>

          <div className="admin-topbar-actions">
            {activeTab === 'templates' && (
              <button
                type="button"
                onClick={() => handleOpenTemplateModal()}
                className="admin-btn-primary"
              >
                <span>➕</span>
                <span>إضافة قالب قانوني جديد</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'overview') loadDashboardStats();
                if (activeTab === 'users') loadUsers();
                if (activeTab === 'documents') loadDocuments();
                if (activeTab === 'templates') loadTemplates();
              }}
              className="admin-btn-secondary"
              title="تحديث البيانات"
            >
              🔄 تحديث
            </button>
          </div>
        </header>

        {/* ===================== TAB 1: OVERVIEW ===================== */}
        {activeTab === 'overview' && (
          <div className="admin-tab-content">
            {/* KPI Metric Cards */}
            <div className="admin-kpi-grid">
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon-wrap kpi-blue">👥</div>
                <div className="admin-kpi-meta">
                  <span className="admin-kpi-label">إجمالي المستخدمين</span>
                  <span className="admin-kpi-val">{stats?.totalUsers ?? '0'}</span>
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-icon-wrap kpi-emerald">📜</div>
                <div className="admin-kpi-meta">
                  <span className="admin-kpi-label">العقود والوثائق المنشأة</span>
                  <span className="admin-kpi-val">{stats?.totalDocuments ?? '0'}</span>
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-icon-wrap kpi-purple">💬</div>
                <div className="admin-kpi-meta">
                  <span className="admin-kpi-label">جلسات الاستشارة</span>
                  <span className="admin-kpi-val">{stats?.totalSessions ?? '0'}</span>
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-icon-wrap kpi-gold">⚖️</div>
                <div className="admin-kpi-meta">
                  <span className="admin-kpi-label">القوالب القانونية النشطة</span>
                  <span className="admin-kpi-val">{stats?.totalTemplates ?? '0'}</span>
                </div>
              </div>
            </div>

            {/* Split Grid: Templates Breakdown & Recent Activity */}
            <div className="admin-split-grid">
              {/* Card 1: Distribution of Contracts */}
              <div className="admin-panel-card">
                <div className="admin-panel-header">
                  <h3>توزيع العقود حسب النوع</h3>
                  <span className="admin-badge-count">{templateStats.length} نماذج</span>
                </div>

                <div className="admin-progress-list">
                  {templateStats.map((ts) => {
                    const total = stats?.totalDocuments || 1;
                    const count = parseInt(ts.count, 10);
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={ts.template_id} className="admin-progress-item">
                        <div className="admin-progress-info">
                          <span className="admin-progress-title">{ts.title}</span>
                          <span className="admin-progress-count">{count} عقد ({pct}%)</span>
                        </div>
                        <div className="admin-progress-bar-bg">
                          <div
                            className="admin-progress-bar-fill"
                            style={{ width: `${Math.max(pct, 5)}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                  {templateStats.length === 0 && (
                    <p className="admin-empty-text">لا توجد عقود مولدة حتى الآن</p>
                  )}
                </div>
              </div>

              {/* Card 2: Recent Generated Documents */}
              <div className="admin-panel-card">
                <div className="admin-panel-header">
                  <h3>أحدث العقود المولدة في المنصة</h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('documents')}
                    className="admin-link-btn"
                  >
                    عرض الكل ←
                  </button>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>نوع العقد</th>
                        <th>المستخدم</th>
                        <th>التاريخ</th>
                        <th>الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentDocs.map((doc) => (
                        <tr key={doc.id}>
                          <td className="font-bold">{doc.template_title}</td>
                          <td>
                            <div className="admin-user-cell">
                              <span className="cell-name">{doc.user_name}</span>
                              <span className="cell-email">{doc.user_email}</span>
                            </div>
                          </td>
                          <td>
                            {new Date(doc.created_at).toLocaleDateString('ar-MA', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleOpenDocPreview(doc)}
                              className="admin-table-btn"
                              title="معاينة العقد"
                            >
                              👁️ معاينة
                            </button>
                          </td>
                        </tr>
                      ))}
                      {recentDocs.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-muted">
                            لم يتم إنشاء أي عقود بعد
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: USERS ===================== */}
        {activeTab === 'users' && (
          <div className="admin-tab-content">
            <div className="admin-panel-card">
              <div className="admin-table-controls">
                <div className="admin-search-wrap">
                  <span>🔍</span>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو البريد الإلكتروني..."
                    className="admin-search-input"
                  />
                </div>
                <div className="admin-table-stat">
                  إجمالي المستخدمين: <strong>{filteredUsers.length}</strong>
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>المستخدم</th>
                      <th>البريد الإلكتروني</th>
                      <th>الرتبة / الصلاحية</th>
                      <th>العقود المنشأة</th>
                      <th>جلسات الشات</th>
                      <th>تاريخ التسجيل</th>
                      <th>تعديل الصلاحية</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isCurrent = currentUser?.id === u.id;
                      return (
                        <tr key={u.id}>
                          <td>
                            <div className="admin-user-cell">
                              <span className="cell-name font-bold">{u.name}</span>
                              {isCurrent && <span className="admin-self-badge">(أنت)</span>}
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>
                            <span
                              className={`admin-role-badge ${
                                u.role === 'admin' ? 'role-admin' : 'role-user'
                              }`}
                            >
                              {u.role === 'admin' ? '🛡️ مشرف (Admin)' : '👤 مستخدم عادي'}
                            </span>
                          </td>
                          <td className="font-bold">{u.total_documents || '0'}</td>
                          <td>{u.total_sessions || '0'}</td>
                          <td>
                            {new Date(u.created_at).toLocaleDateString('ar-MA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td>
                            <button
                              type="button"
                              disabled={isCurrent || updatingUserId === u.id}
                              onClick={() => handleToggleRole(u.id, u.role)}
                              className={`admin-role-toggle-btn ${
                                u.role === 'admin' ? 'btn-demote' : 'btn-promote'
                              }`}
                            >
                              {updatingUserId === u.id
                                ? 'جاري التحديث...'
                                : u.role === 'admin'
                                ? 'تحويل لمستخدم عادي'
                                : 'ترقية لمشرف 🛡️'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-muted">
                          لا توجد نتائج مطابقة للبحث
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 3: DOCUMENTS ===================== */}
        {activeTab === 'documents' && (
          <div className="admin-tab-content">
            <div className="admin-panel-card">
              <div className="admin-table-controls">
                <div className="admin-search-wrap">
                  <span>🔍</span>
                  <input
                    type="text"
                    value={docSearch}
                    onChange={(e) => setDocSearch(e.target.value)}
                    placeholder="ابحث باسم العقد أو المستخدم..."
                    className="admin-search-input"
                  />
                </div>

                <div className="admin-filter-group">
                  <label>نوع القالب:</label>
                  <select
                    value={docFilter}
                    onChange={(e) => setDocFilter(e.target.value)}
                    className="admin-select"
                  >
                    <option value="all">كل العقود والوثائق</option>
                    {templates.map((t) => (
                      <option key={t.id} value={String(t.id)}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>معرف العقد</th>
                      <th>نوع الوثيقة</th>
                      <th>المستخدم المنشئ</th>
                      <th>أهم المعطيات المستخرجة</th>
                      <th>تاريخ الصدور</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.map((doc) => {
                      const dataKeys = Object.keys(doc.user_data || {}).slice(0, 3);
                      return (
                        <tr key={doc.id}>
                          <td className="font-mono text-muted">#{doc.id}</td>
                          <td className="font-bold">{doc.template_title}</td>
                          <td>
                            <div className="admin-user-cell">
                              <span className="cell-name">{doc.user_name}</span>
                              <span className="cell-email">{doc.user_email}</span>
                            </div>
                          </td>
                          <td>
                            <div className="admin-tags-wrap">
                              {dataKeys.map((k) => (
                                <span key={k} className="admin-field-tag">
                                  {doc.user_data[k]}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>
                            {new Date(doc.created_at).toLocaleDateString('ar-MA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleOpenDocPreview(doc)}
                              className="admin-btn-primary py-1 px-3 text-sm"
                            >
                              👁️ معاينة وطباعة
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredDocs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-muted">
                          لا توجد عقود مسجلة مطابقة للفلاتر
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 4: TEMPLATES ===================== */}
        {activeTab === 'templates' && (
          <div className="admin-tab-content">
            <div className="admin-templates-grid">
              {templates.map((tpl) => (
                <div key={tpl.id} className="admin-template-card">
                  <div className="admin-tpl-card-top">
                    <span className="admin-tpl-icon">⚖️</span>
                    <span className="admin-tpl-usage-badge">
                      استُخدم {tpl.total_generated || '0'} مرة
                    </span>
                  </div>

                  <h3 className="admin-tpl-title">{tpl.title}</h3>
                  <p className="admin-tpl-desc">{tpl.description}</p>

                  <div className="admin-tpl-fields-section">
                    <span className="admin-tpl-fields-label">
                      الحقول المطلوبة ({tpl.required_fields?.length || 0}):
                    </span>
                    <div className="admin-tpl-tags">
                      {tpl.required_fields?.map((f) => (
                        <span key={f.key} className="admin-tpl-field-chip" title={f.description}>
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="admin-tpl-card-footer">
                    <button
                      type="button"
                      onClick={() => handleOpenTemplateModal(tpl)}
                      className="admin-btn-secondary w-full"
                    >
                      ✏️ تعديل نصوص وبنود القالب
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ===================== MODAL 1: PREVIEW DOCUMENT ===================== */}
      {previewDoc && (
        <div className="admin-modal-backdrop" onClick={() => setPreviewDoc(null)}>
          <div className="admin-modal-container max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <h2>{previewDoc.template_title}</h2>
                <span className="text-sm text-muted">
                  المستخدم: {previewDoc.user_name} ({previewDoc.user_email}) • المعرف #{previewDoc.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="admin-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="admin-preview-paper">
                <div className="legal-doc-header-band text-center mb-6 pb-4 border-b border-purple-900">
                  <div className="text-xs text-purple-400 font-bold mb-1">
                    وثيقة قانونية رسمية • منصة سند
                  </div>
                  <h1 className="text-2xl font-bold text-white">{previewDoc.template_title}</h1>
                </div>

                <div className="admin-preview-text">
                  {previewContent
                    .replace(/^#\s+[^\n]+/m, '')
                    .replace(/\*\*(.*?)\*\*/g, '$1')
                    .replace(/^###\s+(.*)/gm, '\n❖ $1:\n')
                    .trim()}
                </div>
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewContent);
                  alert('تم نسخ نص العقد إلى الحافظة بنجاح!');
                }}
                className="admin-btn-secondary"
              >
                📋 نسخ النص
              </button>
              <button
                type="button"
                onClick={handlePrintClean}
                className="admin-btn-primary"
              >
                🖨️ طباعة / تصدير كـ PDF نقي (A4)
              </button>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="admin-btn-secondary"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: CREATE / EDIT TEMPLATE ===================== */}
      {templateModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setTemplateModalOpen(false)}>
          <div className="admin-modal-container max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <form
              onSubmit={handleSaveTemplate}
              style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '90vh', overflow: 'hidden' }}
            >
              <div className="admin-modal-header">
                <h2>{editingTemplate ? 'تعديل القالب القانوني' : 'إضافة قالب عقد جديد'}</h2>
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="admin-modal-close"
                >
                  ✕
                </button>
              </div>

              <div className="admin-modal-body space-y-4">
                <div>
                  <label className="admin-form-label">عنوان العقد:</label>
                  <input
                    type="text"
                    required
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                    placeholder="مثال: عقد بيع دراجة نارية مستعملة"
                    className="admin-form-input"
                  />
                </div>

                <div>
                  <label className="admin-form-label">الوصف والغرض القانوني:</label>
                  <input
                    type="text"
                    required
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder="وصف مختصر لمجال تطبيق العقد..."
                    className="admin-form-input"
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="admin-form-label" style={{ marginBottom: 0 }}>
                      نص القالب القانوني (ضع أي متغير ترغب فيه بين قوسين مثل &#123;&#123;اسم_المتغير&#125;&#125;):
                    </label>
                    <button
                      type="button"
                      onClick={() => setTemplateVariables(extractVariables(templateForm.content_template, templateVariables))}
                      className="admin-btn-secondary py-1 px-3 text-xs"
                      title="استخراج وتحديث المتغيرات من النص"
                    >
                      ⚡ تحديث المتغيرات (تم)
                    </button>
                  </div>
                  <textarea
                    rows={9}
                    required
                    value={templateForm.content_template}
                    onChange={(e) => handleContentTemplateChange(e.target.value)}
                    className="admin-form-textarea font-mono text-sm"
                    placeholder="اكتب هنا بنود العقد، مثلاً: اتفق الطرف الأول {{party_one}} مع الطرف الثاني {{party_two}} على بيع المركبة بمبلغ {{sale_price}}..."
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                    <label className="admin-form-label" style={{ marginBottom: 0 }}>
                      المتغيرات المستخرجة تلقائياً من العقد ({templateVariables.length}):
                    </label>
                    <span className="text-xs text-purple-300">
                      يتم توليد حقول السؤال والتحقق تلقائياً لكل كلمة بين &#123;&#123;&#125;&#125;
                    </span>
                  </div>

                  {templateVariables.length === 0 ? (
                    <div className="admin-var-empty-state">
                      لم يتم العثور على متغيرات بعد. اكتب مثلاً <code>&#123;&#123;party_one&#125;&#125;</code> أو <code>&#123;&#123;sale_price&#125;&#125;</code> في متن العقد أعلاه وسيظهر حقل إعداده هنا فوراً!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {templateVariables.map((v) => (
                        <div key={v.key} className="admin-var-card">
                          <div className="admin-var-header">
                            <span className="admin-var-badge">&#123;&#123;{v.key}&#125;&#125;</span>
                            <span className="admin-var-tag-sub">متغير تفاعلي في العقد</span>
                          </div>

                          <div className="admin-var-grid">
                            <div>
                              <label className="text-xs text-purple-300 block mb-1">
                                السؤال الموجه للعميل (Question):
                              </label>
                              <input
                                type="text"
                                required
                                value={v.label}
                                onChange={(e) => updateVariableField(v.key, 'label', e.target.value)}
                                placeholder="مثال: ما هو الاسم الكامل للطرف الأول؟"
                                className="admin-form-input text-sm"
                              />
                            </div>

                            <div>
                              <label className="text-xs text-purple-300 block mb-1">
                                نوع البيانات والتحقق (Validation):
                              </label>
                              <select
                                value={v.type}
                                onChange={(e) => updateVariableField(v.key, 'type', e.target.value as any)}
                                className="admin-form-input text-sm"
                              >
                                <option value="string">🔤 نص (String)</option>
                                <option value="number">🔢 رقم / مبلغ (Number)</option>
                                <option value="date">📅 تاريخ (Date)</option>
                              </select>
                            </div>
                          </div>

                          <div className="admin-var-subrow">
                            <label className="text-xs text-muted block mb-1">
                              توجيه إضافي للذكاء الاصطناعي (LLM Guidance):
                            </label>
                            <input
                              type="text"
                              value={v.description}
                              onChange={(e) => updateVariableField(v.key, 'description', e.target.value)}
                              placeholder="توجيه إضافي للروبوت لاستخراج هذا الحقل بدقة..."
                              className="admin-form-input text-xs text-muted"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="admin-modal-footer">
                <button type="submit" className="admin-btn-primary">
                  💾 حفظ القالب
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="admin-btn-secondary"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
