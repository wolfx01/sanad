'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // التحقق من حالة تسجيل الدخول
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
  }, [messages]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const sendMessageContent = async (text: string) => {
    if (!text.trim() || sending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!res.ok) {
        throw new Error('فشل معالجة الطلب');
      }

      const data = await res.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          data.reply ||
          'تم استلام طلبك، نقوم حالياً بتجهيز حقول العقد والأسئلة المطلوبة...',
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'عذراً، حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessageContent(input);
  };

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
    <div className="chat-layout" dir="rtl">
      {/* الشريط العلوي */}
      <header className="chat-header">
        <div className="chat-brand">
          <Link href="/" className="chat-logo">
            سَـ<span>نَد</span>
          </Link>
          <span className="chat-badge">المساعد الذكي</span>
        </div>

        <div className="chat-user-area">
          <div className="chat-user-info">
            <div className="chat-user-name">{user?.name}</div>
            <div className="chat-user-email">{user?.email}</div>
          </div>
          <button onClick={handleLogout} className="chat-btn-logout">
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* منطقة الرسائل */}
      <main className="chat-main-container">
        <div className="chat-messages-wrap">
          {messages.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '4rem 1rem 2rem',
              }}
              className="animate-fade-in-up"
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  background: 'rgba(232, 168, 124, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
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
                  maxWidth: '480px',
                  lineHeight: '1.7',
                  marginBottom: '2rem',
                }}
              >
                ابدأ بكتابة طلبك أو نوع العقد الذي ترغب في صياغته في حقل الإدخال بالأسفل.
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
                  <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                </div>
              </div>
            ))
          )}

          {sending && (
            <div className="chat-row chat-row-assistant">
              <div className="chat-bubble chat-bubble-assistant chat-typing">
                <span>⚡ سند يحلل الطلب الآن...</span>
              </div>
            </div>
          )}

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
            placeholder="اكتب نوع الوثيقة أو تفاصيل العقد هنا..."
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
          سند هو نظام ذكاء اصطناعي لأتمتة العقود. راجع دائماً الشروط الخاصة بك قبل الاعتماد النهائي.
        </p>
      </footer>
    </div>
  );
}
