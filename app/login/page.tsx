'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل تسجيل الدخول');
      }

      setSuccess('تم تسجيل الدخول بنجاح! جاري تحويلك...');
      setTimeout(() => {
        router.push('/chat');
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card animate-fade-in-up">
        <div className="auth-header">
          <Link href="/" className="auth-brand">
            سَـ<span>نَد</span>
          </Link>
          <h1 className="auth-title">تسجيل الدخول</h1>
          <p className="auth-subtitle">مرحباً بعودتك! سجّل دخولك للوصول إلى وثائقك</p>
        </div>

        {error && <div className="auth-alert auth-alert-error">{error}</div>}
        {success && <div className="auth-alert auth-alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              البريد الإلكتروني
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="example@sanad.sa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              dir="ltr"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              كلمة المرور
            </label>
            <input
              id="password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              dir="ltr"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="auth-switch">
          ليس لديك حساب بعد؟
          <Link href="/register">إنشاء حساب جديد</Link>
        </div>
      </div>
    </div>
  );
}
