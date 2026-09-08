'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface RequiredField {
  key: string;
  label: string;
  type: string;
  description: string;
}

interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // حالة الشريط الجانبي (Sidebar)
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // حالة المحادثة
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // حالة استخراج العقد
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [templateTitle, setTemplateTitle] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<Record<string, any>>({});
  const [requiredFields, setRequiredFields] = useState<RequiredField[] | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // حالة نافذة المعاينة
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [activeModalTitle, setActiveModalTitle] = useState<string>('');
  const [previewContent, setPreviewContent] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);


  // تحميل جلسة معينة مع رسائلها
  const loadSession = async (id: number) => {
    try {
      const res = await fetch(`/api/chat?sessionId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      setSessionId(data.session.id);
      setTemplateId(data.templateId || null);
      setTemplateTitle(data.templateTitle || null);
      setExtractedFields(data.extractedFields || {});
      setRequiredFields(data.requiredFields || null);
      setIsComplete(Boolean(data.isComplete));
      setMessages(
        (data.messages || []).map((m: any) => ({
          id: m.id.toString(),
          role: m.role,
          content: m.content,
        }))
      );
    } catch (e) {
      console.error('Failed to load session:', e);
    }
  };

  // بدء محادثة جديدة
  const startNewChat = () => {
    setSessionId(null);
    setTemplateId(null);
    setTemplateTitle(null);
    setExtractedFields({});
    setRequiredFields(null);
    setIsComplete(false);
    setMessages([]);
  };

  // 1. التحقق من جلسة المستخدم واسترجاع آخر محادثة تلقائياً
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setUser(data.user);

        // جلب المحادثات السابقة واسترجاع أحدث محادثة
        const sessionsRes = await fetch('/api/chat');
        if (sessionsRes.ok) {
          const sessionsData = await sessionsRes.json();
          const userSessions = sessionsData.sessions || [];
          setSessions(userSessions);
          if (userSessions.length > 0) {
            await loadSession(userSessions[0].id);
          }
        }
      } catch {
        router.push('/login');
      } finally {
        setLoadingUser(false);
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isComplete]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // 2. إرسال الرسالة إلى الـ API بنمط الـ Streaming
  const sendMessageContent = async (text: string) => {
    if (!text.trim() || sending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    const assistantMsgId = (Date.now() + 1).toString();

    // إضافة رسالة المستخدم ورسالة المساعد كرسالة قيد الكتابة
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
      },
    ]);

    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error('فشل معالجة الطلب');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // طابور تدفق سلس لعرض الكلمات كلمة بعد كلمة (ChatGPT-like Typing)
      const tokenQueue: string[] = [];
      let displayedText = '';
      let isLoopActive = false;
      let isDoneReceiving = false;
      let metaFinalReply: string | null = null;

      const startTypingLoop = () => {
        if (isLoopActive) return;
        isLoopActive = true;

        const timer = setInterval(() => {
          if (tokenQueue.length > 0) {
            // نأخذ كلمة أو جزء صغير
            const nextToken = tokenQueue.shift()!;
            displayedText += nextToken;

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: displayedText } : msg
              )
            );
          } else if (isDoneReceiving) {
            clearInterval(timer);
            isLoopActive = false;
            // إذا كان هناك رد نهائي من الميتاداتا
            if (metaFinalReply && metaFinalReply !== displayedText) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: metaFinalReply! } : msg
                )
              );
            }
          }
        }, 22); // تدفق سلس كل 22 ملي ثانية
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          isDoneReceiving = true;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          try {
            const event = JSON.parse(trimmed.slice(5).trim());

            if (event.type === 'init') {
              if (event.sessionId) setSessionId(event.sessionId);
              if (event.templateId) setTemplateId(event.templateId);
              if (event.templateTitle) setTemplateTitle(event.templateTitle);
              if (event.extractedFields) setExtractedFields(event.extractedFields);
              if (event.requiredFields) setRequiredFields(event.requiredFields);
            } else if (event.type === 'chunk') {
              if (event.text) {
                // تقسيم الـ chunk إلى كلمات ومسافات لتتدفق واحدة تلو الأخرى
                const parts = event.text.match(/(\s+|\S+)/g) || [event.text];
                tokenQueue.push(...parts);
                startTypingLoop();
              }
            } else if (event.type === 'meta') {
              if (event.sessionId) setSessionId(event.sessionId);
              if (event.templateId) setTemplateId(event.templateId);
              if (event.templateTitle) setTemplateTitle(event.templateTitle);
              if (event.extractedFields) setExtractedFields(event.extractedFields);
              if (event.requiredFields) setRequiredFields(event.requiredFields);
              if (event.isComplete !== undefined) setIsComplete(event.isComplete);
              if (event.finalReply) {
                metaFinalReply = event.finalReply;
              }

              // تحديث قائمة الجلسات
              fetch('/api/chat')
                .then((r) => r.json())
                .then((d) => {
                  if (d.sessions) setSessions(d.sessions);
                })
                .catch(() => {});
            } else if (event.type === 'done') {
              isDoneReceiving = true;
            }
          } catch (err) {
            console.warn('Error parsing SSE event:', err);
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: 'عذراً، حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
              }
            : msg
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessageContent(input);
  };

  // 3. فتح معاينة الوثيقة الحالية
  const handleOpenPreview = async () => {
    if (!templateId) return;
    setActiveModalTitle(templateTitle || 'المستند القانوني');
    setLoadingPreview(true);
    setShowPreviewModal(true);

    try {
      const res = await fetch('/api/documents/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          fields: extractedFields,
        }),
      });
      const data = await res.json();
      setPreviewContent(data.content || '');
    } catch {
      setPreviewContent('تعذر تحميل معاينة الوثيقة، يرجى المحاولة لاحقاً.');
    } finally {
      setLoadingPreview(false);
    }
  };

  // فتح معاينة وثيقة محددة من رسالة سابقة محفوظة
  const handleOpenSpecificDocument = async (
    targetTemplateId: number,
    targetTitle: string,
    targetFields: Record<string, any>
  ) => {
    setActiveModalTitle(targetTitle || 'المستند القانوني');
    setLoadingPreview(true);
    setShowPreviewModal(true);

    try {
      const res = await fetch('/api/documents/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: targetTemplateId,
          fields: targetFields,
        }),
      });
      const data = await res.json();
      setPreviewContent(data.content || '');
    } catch {
      setPreviewContent('تعذر تحميل معاينة الوثيقة، يرجى المحاولة لاحقاً.');
    } finally {
      setLoadingPreview(false);
    }
  };

  // استخراج مسميات أطراف العقد بدقة (بائع/مشتري، مؤجر/مستأجر)
  const getPartyLabels = (title: string, content: string = '') => {
    const combined = `${title} ${content}`;
    if (combined.includes('سيارة') || combined.includes('بيع') || combined.includes('بائع') || combined.includes('المشتري')) {
      return { first: 'توقيع البائع', second: 'توقيع المشتري' };
    }
    if (combined.includes('كراء') || combined.includes('إيجار') || combined.includes('مؤجر') || combined.includes('مكتري') || combined.includes('المكري')) {
      return { first: 'توقيع المؤجر (المكري)', second: 'توقيع المستأجر (المكتري)' };
    }
    return { first: 'توقيع الطرف الأول', second: 'توقيع الطرف الثاني' };
  };

  // تنظيف وتنسيق نص العقد وإزالة أسطر التوقيع النصية المكررة
  const formatContractBody = (content: string) => {
    return content
      .replace(/^#\s+[^\n]+/m, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/^###\s+(.*)/gm, '\n❖ $1:\n')
      .replace(/(?:\r?\n)+[ \t]*(?:توقيع|إمضاء)[\s\S]*$/i, '') // إزالة أي سطر توقيع نصي في النهاية لتجنب الازدواجية
      .trim();
  };

  // طباعة المستند القانوني بشكل نقي ومستقل بنسبة 100% بدون واجهة الموقع أو الشريط الجانبي
  const handlePrintCleanDocument = () => {
    const docTitle = activeModalTitle || templateTitle || 'وثيقة قانونية';
    const formattedContent = formatContractBody(previewContent);
    const partyLabels = getPartyLabels(docTitle, previewContent);

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      window.print();
      return;
    }


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
            <div class="legal-doc-badge">وثيقة قانونية • منصة سند</div>
            <h1 class="legal-doc-title">${docTitle}</h1>
          </div>
          <div class="legal-doc-body">${formattedContent}</div>
          <div class="legal-signatures-wrap">
            <div class="legal-sign-box">
              <div class="legal-sign-title">${partyLabels.first}</div>
              <div class="legal-sign-line">...................................................</div>
            </div>
            <div class="legal-sign-box">
              <div class="legal-sign-title">${partyLabels.second}</div>
              <div class="legal-sign-line">...................................................</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };



  // حساب نسبة اكتمال الحقول
  const totalFields = requiredFields?.length || 0;
  const completedFields = requiredFields
    ? requiredFields.filter((f) => extractedFields[f.key] !== undefined && extractedFields[f.key] !== '').length
    : 0;
  const progressPercent = totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;

  if (loadingUser) {
    return (
      <div className="auth-page-wrapper">
        <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
          جاري التحقق من الجلسة...
        </div>
      </div>
    );
  }

  return (
    <div className="chat-app-wrapper" dir="rtl">
      {/* ==================== الشريط الجانبي (Sidebar مثل ChatGPT) ==================== */}
      <aside className={`chat-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        {/* رأس الشريط الجانبي */}
        <div className="sidebar-header">
          <div className="chat-brand">
            <Link href="/" className="chat-logo" style={{ fontSize: '1.4rem' }}>
              سَـ<span>نَد</span>
            </Link>
            <span className="chat-badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.55rem' }}>
              المساعد الذكي
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="btn-toggle-sidebar"
            title="إخفاء القائمة الجانبية"
            style={{
              background: 'transparent',
              color: '#64748b',
              border: 'none',
              width: '32px',
              height: '32px',
            }}
          >
            ◀
          </button>
        </div>

        {/* زر محادثة جديدة (مثل New Chat في ChatGPT) */}
        <button
          type="button"
          onClick={startNewChat}
          className="sidebar-btn-new-chat"
        >
          <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>+</span>
          <span>محادثة جديدة</span>
        </button>

        {/* قائمة المحادثات والعقود السابقة */}
        <div className="sidebar-sessions-list">
          <div className="sidebar-sessions-label">
            <span>📜</span>
            <span>سجل العقود والمحادثات ({sessions.length})</span>
          </div>

          {sessions.length === 0 ? (
            <div style={{ fontSize: '0.82rem', color: '#94a3b8', padding: '1.5rem 1rem', textAlign: 'center' }}>
              لا توجد محادثات سابقة بعد
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => loadSession(s.id)}
                className={`sidebar-session-item ${sessionId === s.id ? 'active' : ''}`}
              >
                <span style={{ fontSize: '1.1rem' }}>📄</span>
                <div className="sidebar-session-info">
                  <div>{s.template_title || s.title || 'محادثة صياغة عقد'}</div>
                  <div className="sidebar-session-date">
                    {new Date(s.created_at).toLocaleDateString('ar-EG', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* زر لوحة تحكم المشرف للمدراء */}
        {user?.role === 'admin' && (
          <div style={{ padding: '0 0.85rem 0.65rem' }}>
            <Link
              href="/admin"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.65rem 0.8rem',
                background: '#0f172a',
                color: '#ffffff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid #0f172a',
                transition: 'all 0.2s ease',
              }}
            >
              <span>🛡️</span>
              <span>لوحة الإدارة (Admin)</span>
            </Link>
          </div>
        )}

        {/* تذييل الشريط الجانبي: معلومات المستخدم وزر الخروج */}
        <div className="sidebar-footer">
          <div className="chat-user-info" style={{ textAlign: 'right' }}>
            <div className="chat-user-name" style={{ fontSize: '0.88rem' }}>{user?.name}</div>
            <div className="chat-user-email" style={{ fontSize: '0.72rem' }}>{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="chat-btn-logout"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
          >
            خروج
          </button>
        </div>
      </aside>

      {/* ==================== المنطقة الرئيسية للمحادثة ==================== */}
      <div className="chat-main-area">
        {/* شريط علوي صغير للتحكم */}
        <div className="chat-top-navbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="btn-toggle-sidebar"
                title="إظهار القائمة الجانبية"
              >
                ☰
              </button>
            )}
            <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--foreground)' }}>
              {templateTitle ? `المستند القانوني: ${templateTitle}` : 'سند • المساعد القانوني الآلي'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isComplete && (
              <button
                type="button"
                onClick={handleOpenPreview}
                className="btn-generate-doc"
                style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }}
              >
                <span>📄</span>
                <span>معاينة وتحميل العقد (PDF)</span>
              </button>
            )}
          </div>
        </div>

        {/* منطقة الرسائل */}
        <main className="chat-main-container">
          {/* شريط تتبع تقدم العقد إذا تم اختيار نموذج */}
          {templateTitle && (
            <div className="contract-tracker-bar animate-fade-in-up">
              <div className="tracker-header">
                <div className="tracker-title">
                  <span>📄</span>
                  <span>المستند الجاري إعداده: <strong>{templateTitle}</strong></span>
                </div>
                <div className="tracker-badge">
                  {completedFields} من أصل {totalFields} حقول ({progressPercent}%)
                </div>
              </div>

              <div className="tracker-progress-bg">
                <div
                  className="tracker-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {requiredFields && (
                <div className="tracker-fields-pills">
                  {requiredFields.map((field) => {
                    const isDone = extractedFields[field.key] !== undefined && extractedFields[field.key] !== '';
                    return (
                      <span
                        key={field.key}
                        className={`tracker-pill ${
                          isDone ? 'tracker-pill-done' : 'tracker-pill-pending'
                        }`}
                        title={field.description}
                      >
                        {isDone ? '✓ ' : '○ '}
                        {field.label}: {isDone ? String(extractedFields[field.key]) : 'قيد الانتظار'}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="chat-messages-wrap">
            {messages.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: '3rem 1rem 2rem',
                }}
                className="animate-fade-in-up"
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: '#f1f5f9',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  ⚖️
                </div>
                <h2
                  style={{
                    fontSize: '1.6rem',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                    color: 'var(--foreground)',
                  }}
                >
                  مرحباً بك {user?.name ? `يا ${user.name}` : ''} في سَنَد
                </h2>
                <p
                  style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-muted)',
                    maxWidth: '520px',
                    lineHeight: '1.7',
                    marginBottom: '2rem',
                  }}
                >
                  اكتب طلبك في حقل الإدخال بالأسفل، مثلاً: <strong>"أريد كتابة عقد كراء شقة"</strong> أو <strong>"أريد عقد بيع سيارة"</strong> وسيرشدك سند خطوة بخطوة.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-row ${
                    msg.role === 'user' ? 'chat-row-user' : 'chat-row-assistant'
                  }`}
                >
                  <div
                    className={`chat-bubble ${
                      msg.role === 'user'
                        ? 'chat-bubble-user'
                        : 'chat-bubble-assistant'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="chat-assistant-tag">
                        <span>⚖️</span>
                        <span>سَنَد • المساعد القانوني</span>
                      </div>
                    )}
                    {msg.content ? (
                      msg.content.includes('[CONTRACT_ACTION:') ? (
                        <div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            {msg.content.replace(/\[CONTRACT_ACTION:[\s\S]*?\]/, '').trim()}
                          </div>
                          {(() => {
                            try {
                              const match = msg.content.match(/\[CONTRACT_ACTION:([\s\S]*?)\]/);
                              if (!match) return null;
                              const actionData = JSON.parse(match[1]);
                              return (
                                <div
                                  style={{
                                    marginTop: '0.85rem',
                                    padding: '0.85rem 1rem',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '0.95rem',
                                      color: 'var(--foreground)',
                                      marginBottom: '0.3rem',
                                    }}
                                  >
                                    📄 مستند رسمي جاهز: {actionData.title}
                                  </div>
                                  <p
                                    style={{
                                      fontSize: '0.82rem',
                                      color: 'var(--text-muted)',
                                      marginBottom: '0.75rem',
                                    }}
                                  >
                                    بيانات هذا العقد مكتملة ومحفوظة بنجاح، ويمكنك معاينته أو تحميله كـ PDF في أي وقت.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenSpecificDocument(
                                        actionData.templateId,
                                        actionData.title,
                                        actionData.fields
                                      )
                                    }
                                    className="btn-generate-doc"
                                    style={{
                                      width: '100%',
                                      justifyContent: 'center',
                                      fontSize: '0.92rem',
                                      padding: '0.75rem 1rem',
                                    }}
                                  >
                                    <span>📄</span>
                                    <span>معاينة وتحميل {actionData.title} (PDF)</span>
                                  </button>
                                </div>
                              );
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                      )
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.88rem' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#3b82f6', animation: 'pulse 1s infinite' }}></span>
                        <span>جاري الكتابة...</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}


            {/* رسائل المحادثة تنتهي هنا */}

            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* شريط الإدخال السفلي */}
        <footer className="chat-footer">
          <form onSubmit={handleFormSubmit} className="chat-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب رسالتك أو البيانات المطلوبة هنا..."
              className="chat-input"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="chat-btn-send"
            >
              إرسال
            </button>
          </form>
          <p className="chat-note">
            سند هو نظام ذكاء اصطناعي لأتمتة العقود. راجع دائماً الشروط القانونية قبل التوقيع النهائي.
          </p>
        </footer>
      </div>

      {/* ==================== نافذة معاينة العقد المنبثقة ==================== */}
      {showPreviewModal && (
        <div className="doc-modal-overlay no-print" onClick={() => setShowPreviewModal(false)}>
          <div className="doc-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="doc-modal-header no-print">
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--foreground)' }}>
                  معاينة المستند القانوني: {activeModalTitle || templateTitle}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  جاهز للطباعة أو الحفظ كـ PDF رسمي
                </span>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                ✕
              </button>
            </div>

            <div className="doc-modal-body">
              {loadingPreview ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  جاري تجهيز وثيقة العقد...
                </div>
              ) : (
                <div className="legal-document-sheet">
                  <div className="legal-doc-header-band">
                    <div className="legal-doc-badge">وثيقة قانونية • منصة سند</div>
                    <h1 className="legal-doc-title">{activeModalTitle || templateTitle}</h1>
                  </div>

                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '2.1', fontSize: '0.98rem', color: '#1a1a2e' }}>
                    {formatContractBody(previewContent)}
                  </div>

                  {(() => {
                    const partyLabels = getPartyLabels(activeModalTitle || templateTitle || '', previewContent);
                    return (
                      <div className="legal-signatures-wrap">
                        <div className="legal-sign-box">
                          <div className="legal-sign-title">{partyLabels.first}</div>
                          <div className="legal-sign-line">...................................................</div>
                        </div>
                        <div className="legal-sign-box">
                          <div className="legal-sign-title">{partyLabels.second}</div>
                          <div className="legal-sign-line">...................................................</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="doc-modal-footer no-print">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(previewContent);
                  alert('تم نسخ نص العقد إلى الحافظة بنجاح!');
                }}
                className="chat-btn-logout"
                style={{ padding: '0.75rem 1.25rem', borderColor: 'var(--border)' }}
              >
                📋 نسخ النص
              </button>
              <button
                type="button"
                onClick={handlePrintCleanDocument}
                className="btn-generate-doc"
              >
                <span>🖨️</span>
                <span>طباعة / حفظ كـ PDF نقي</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="chat-btn-logout"
                style={{ padding: '0.75rem 1.25rem' }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* منطقة الطباعة المخصصة الخالية تماماً من الواجهة والنوافذ المنبثقة */}
      {previewContent && (
        <div id="printable-legal-doc" style={{ display: 'none' }}>
          <div className="legal-document-sheet">
            <div className="legal-doc-header-band">
              <div className="legal-doc-badge">وثيقة قانونية • منصة سند</div>
              <h1 className="legal-doc-title">{activeModalTitle || templateTitle}</h1>
            </div>

            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '2.2', fontSize: '11pt', color: '#000000' }}>
              {formatContractBody(previewContent)}
            </div>

            {(() => {
              const partyLabels = getPartyLabels(activeModalTitle || templateTitle || '', previewContent);
              return (
                <div className="legal-signatures-wrap">
                  <div className="legal-sign-box">
                    <div className="legal-sign-title">{partyLabels.first}</div>
                    <div className="legal-sign-line">...................................................</div>
                  </div>
                  <div className="legal-sign-box">
                    <div className="legal-sign-title">{partyLabels.second}</div>
                    <div className="legal-sign-line">...................................................</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
